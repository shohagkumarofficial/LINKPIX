import { query } from "./db";
import { HttpError } from "./http";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

export function validTimeZone(tz: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Today's date (YYYY-MM-DD) in the given time zone. */
export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function parseDay(s: string): number {
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!DATE_PATTERN.test(s) || Number.isNaN(t)) throw new HttpError(400, "Invalid date. Use YYYY-MM-DD.");
  return t;
}

function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export interface StatsRange {
  from: string;
  to: string;
  days: number;
}

export function resolveRange(from: string | null, to: string | null, tz: string): StatsRange {
  const today = todayIn(tz);
  const toMs = parseDay(to || today);
  const fromMs = parseDay(from || fmtDay(toMs - 6 * DAY_MS));
  if (fromMs > toMs) throw new HttpError(400, "The start date must be before the end date.");
  const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
  if (days > MAX_DAYS) throw new HttpError(400, `Please pick a range of at most ${MAX_DAYS} days.`);
  return { from: fmtDay(fromMs), to: fmtDay(toMs), days };
}

// The same filtered set of clicks is used by every query below.
// $1 owner (or NULL for everyone) · $2 link code (or NULL) · $3 from day · $4 to day · $5 time zone
const BASE = `
WITH c AS (
  SELECT cl.created_at, cl.country, cl.device, cl.os, cl.source, cl.visitor, l.code, l.caption
    FROM clicks cl
    JOIN links l ON l.id = cl.link_id
   WHERE ($1::bigint IS NULL OR l.owner_id = $1::bigint)
     AND ($2::text IS NULL OR l.code = $2::text)
     AND cl.created_at >= ($3::date)::timestamp AT TIME ZONE $5::text
     AND cl.created_at <  (($4::date) + 1)::timestamp AT TIME ZONE $5::text
)`;

export interface Bucket {
  label: string;
  n: number;
}

export interface StatsResult {
  range: StatsRange & { tz: string };
  totals: { clicks: number; uniques: number };
  previous: { clicks: number; uniques: number; from: string; to: string };
  daily: Array<{ day: string; clicks: number; uniques: number }>;
  hours: number[];
  sources: Bucket[];
  countries: Bucket[];
  devices: Bucket[];
  os: Bucket[];
  top_links: Array<{ code: string; caption: string | null; clicks: number; uniques: number }>;
}

export async function getStats(opts: {
  owner: string | null;
  code: string | null;
  range: StatsRange;
  tz: string;
}): Promise<StatsResult> {
  const { owner, code, range, tz } = opts;
  const params = [owner, code, range.from, range.to, tz];

  const prevTo = fmtDay(parseDay(range.from) - DAY_MS);
  const prevFrom = fmtDay(parseDay(range.from) - range.days * DAY_MS);
  const prevParams = [owner, code, prevFrom, prevTo, tz];

  const [totals, previous, daily, hours, breakdown, top] = await Promise.all([
    query<{ clicks: number; uniques: number }>(
      `${BASE} SELECT count(*)::int AS clicks, count(DISTINCT visitor)::int AS uniques FROM c`,
      params,
    ),
    query<{ clicks: number; uniques: number }>(
      `${BASE} SELECT count(*)::int AS clicks, count(DISTINCT visitor)::int AS uniques FROM c`,
      prevParams,
    ),
    query<{ day: string; clicks: number; uniques: number }>(
      `${BASE}
       SELECT to_char(created_at AT TIME ZONE $5::text, 'YYYY-MM-DD') AS day,
              count(*)::int AS clicks, count(DISTINCT visitor)::int AS uniques
         FROM c GROUP BY 1 ORDER BY 1`,
      params,
    ),
    query<{ hour: number; clicks: number }>(
      `${BASE}
       SELECT extract(hour FROM created_at AT TIME ZONE $5::text)::int AS hour, count(*)::int AS clicks
         FROM c GROUP BY 1 ORDER BY 1`,
      params,
    ),
    query<{ k: string; v: string; n: number }>(
      `${BASE}
       SELECT 'source' AS k, coalesce(source, 'Direct') AS v, count(*)::int AS n FROM c GROUP BY 2
       UNION ALL SELECT 'country', coalesce(country, 'Unknown'), count(*)::int FROM c GROUP BY 2
       UNION ALL SELECT 'device', coalesce(device, 'unknown'), count(*)::int FROM c GROUP BY 2
       UNION ALL SELECT 'os', coalesce(os, 'Other'), count(*)::int FROM c GROUP BY 2
       ORDER BY k, n DESC`,
      params,
    ),
    query<{ code: string; caption: string | null; clicks: number; uniques: number }>(
      `${BASE}
       SELECT code, max(caption) AS caption, count(*)::int AS clicks, count(DISTINCT visitor)::int AS uniques
         FROM c GROUP BY code ORDER BY clicks DESC, code LIMIT 10`,
      params,
    ),
  ]);

  // Fill days that had no clicks with zero so the chart has no gaps.
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const filled: StatsResult["daily"] = [];
  const startMs = parseDay(range.from);
  for (let i = 0; i < range.days; i++) {
    const day = fmtDay(startMs + i * DAY_MS);
    const hit = byDay.get(day);
    filled.push({ day, clicks: hit?.clicks ?? 0, uniques: hit?.uniques ?? 0 });
  }

  const hourly = Array.from({ length: 24 }, () => 0);
  for (const h of hours) if (h.hour >= 0 && h.hour < 24) hourly[h.hour] = h.clicks;

  const pick = (k: string): Bucket[] => breakdown.filter((r) => r.k === k).map((r) => ({ label: r.v, n: r.n }));

  return {
    range: { ...range, tz },
    totals: totals[0] ?? { clicks: 0, uniques: 0 },
    previous: { ...(previous[0] ?? { clicks: 0, uniques: 0 }), from: prevFrom, to: prevTo },
    daily: filled,
    hours: hourly,
    sources: pick("source"),
    countries: pick("country"),
    devices: pick("device"),
    os: pick("os"),
    top_links: top,
  };
}

const nf = new Intl.NumberFormat("en-US");

export function fmt(n: number): string {
  return nf.format(n);
}

export function compact(n: number): string {
  if (n < 10000) return nf.format(n);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diff / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function countryName(code: string): string {
  if (code.length !== 2) return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

// ---------- days (YYYY-MM-DD strings, no time zone surprises) ----------

export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function hourLabel(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return `${hh % 12 || 12} ${hh < 12 ? "am" : "pm"}`;
}

// ---------- change vs the previous period ----------

export interface Delta {
  dir: "up" | "down" | "flat" | "new";
  text: string;
}

export function delta(current: number, previous: number): Delta | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { dir: "new", text: "New" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { dir: "flat", text: "No change" };
  return { dir: pct > 0 ? "up" : "down", text: `${Math.abs(pct)}%` };
}

/** Round the top of a chart axis up to a clean number, with at most 4 steps. */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 2, 4] };
  const steps: number[] = [];
  for (let k = 0; k <= 9; k++) for (const m of [1, 2, 5]) steps.push(m * 10 ** k);
  const step = steps.find((s) => Math.ceil(max / s) <= 4) ?? max;
  const count = Math.ceil(max / step);
  const top = count * step;
  return { top, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
}

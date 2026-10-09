"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { BarList, HourChart, TimeChart, type DayPoint } from "./charts";
import { addDays, countryName, delta, fmt, hourLabel, longDay, shortDay, todayIn, type Delta } from "./format";
import { Empty, ErrorLine, Icon, Segmented } from "./ui";

type Preset = "today" | "7d" | "30d" | "90d" | "custom";

interface Bucket {
  label: string;
  n: number;
}

interface Stats {
  range: { from: string; to: string; days: number; tz: string };
  totals: { clicks: number; uniques: number };
  previous: { clicks: number; uniques: number; from: string; to: string };
  daily: DayPoint[];
  hours: number[];
  sources: Bucket[];
  countries: Bucket[];
  devices: Bucket[];
  os: Bucket[];
  top_links: Array<{ code: string; caption: string | null; clicks: number; uniques: number }>;
}

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

function DeltaLine({ d, versus }: { d: Delta | null; versus: string }) {
  if (!d) return <p className="delta-line">Nothing to compare with yet.</p>;
  const cls = d.dir === "up" || d.dir === "new" ? "delta delta-up" : d.dir === "down" ? "delta delta-down" : "delta";
  return (
    <p className="delta-line">
      <span className={cls}>
        {d.dir === "up" || d.dir === "new" ? <Icon name="up" size={14} /> : null}
        {d.dir === "down" ? <Icon name="down" size={14} /> : null}
        {d.dir === "new" ? "New traffic" : d.dir === "flat" ? "No change" : `${d.dir === "up" ? "Up" : "Down"} ${d.text}`}
      </span>{" "}
      <span className="delta-vs">vs {versus}</span>
    </p>
  );
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function AnalyticsTab({
  isAdmin,
  version,
  focusLink,
  onFocusUsed,
}: {
  isAdmin: boolean;
  version: number;
  focusLink: string | null;
  onFocusUsed: () => void;
}) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const today = todayIn(tz);

  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(() => addDays(todayIn(tz), -6));
  const [customTo, setCustomTo] = useState(() => todayIn(tz));
  const [link, setLink] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [options, setOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Opened from a link's "Analytics" button.
  useEffect(() => {
    if (focusLink) {
      if (isAdmin) setScope("all");
      setLink(focusLink);
      onFocusUsed();
    }
  }, [focusLink, isAdmin, onFocusUsed]);

  const range = useMemo(() => {
    if (preset === "today") return { from: today, to: today };
    if (preset === "7d") return { from: addDays(today, -6), to: today };
    if (preset === "30d") return { from: addDays(today, -29), to: today };
    if (preset === "90d") return { from: addDays(today, -89), to: today };
    const a = customFrom <= customTo ? customFrom : customTo;
    const b = customFrom <= customTo ? customTo : customFrom;
    return { from: a, to: b };
  }, [preset, customFrom, customTo, today]);

  // Link choices for the filter.
  useEffect(() => {
    let cancelled = false;
    api<{ links: Array<{ code: string; caption: string | null }> }>(`/api/links?scope=${scope}`)
      .then((res) => {
        if (!cancelled) setOptions(res.links.map((l) => ({ code: l.code, label: l.caption || l.code })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [scope, version]);

  // The numbers. The previous result stays on screen (dimmed) while new numbers load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ from: range.from, to: range.to, tz, scope });
    if (link) qs.set("link", link);
    api<Stats>(`/api/stats?${qs.toString()}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load the numbers.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, link, scope, tz, version]);

  const codeToCaption = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of data?.top_links ?? []) m.set(l.code, l.caption || l.code);
    return m;
  }, [data]);

  const days = data?.range.days ?? 1;
  const versus = days === 1 ? "the day before" : `the previous ${days} days`;
  const rangeText = data
    ? data.range.from === data.range.to
      ? longDay(data.range.from)
      : `${shortDay(data.range.from)} to ${shortDay(data.range.to)}`
    : "";

  const best = data ? data.daily.reduce((a, b) => (b.clicks > a.clicks ? b : a), data.daily[0]) : null;
  const avg = data ? data.totals.clicks / data.range.days : 0;
  const peak = data && Math.max(...data.hours) > 0 ? data.hours.indexOf(Math.max(...data.hours)) : -1;
  const hasClicks = Boolean(data && data.totals.clicks > 0);

  return (
    <div className="tab">
      <header className="tab-head">
        <h1 className="h1">Analytics</h1>
        <p className="lede">How much traffic your links bring, and where it comes from.</p>
      </header>

      <div className="filters">
        <Segmented value={preset} options={PRESETS} onChange={setPreset} label="Date range" />

        {preset === "custom" ? (
          <div className="dates">
            <label>
              <span>From</span>
              <input type="date" value={customFrom} max={today} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={customTo} max={today} onChange={(e) => e.target.value && setCustomTo(e.target.value)} />
            </label>
          </div>
        ) : null}

        <div className="filter-row">
          <label className="select">
            <span className="sr-only">Link</span>
            <select value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="">All links</option>
              {link && !options.some((o) => o.code === link) ? <option value={link}>{link}</option> : null}
              {options.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label.length > 48 ? `${o.label.slice(0, 47)}…` : o.label}
                </option>
              ))}
            </select>
            <Icon name="chevron" size={16} />
          </label>
          {isAdmin ? (
            <Segmented
              value={scope}
              onChange={setScope}
              label="Whose links"
              options={[
                { value: "mine", label: "Mine" },
                { value: "all", label: "Everyone" },
              ]}
            />
          ) : null}
        </div>
      </div>

      {error ? <ErrorLine>{error}</ErrorLine> : null}

      {!data && !error ? <p className="muted-line">Loading…</p> : null}

      {data ? (
        <div className={loading ? "dash dash-busy" : "dash"} aria-busy={loading}>
          <section className="hero" aria-label="Total clicks">
            <p className="hero-label">Clicks</p>
            <p className="hero-num">{fmt(data.totals.clicks)}</p>
            <p className="hero-range">{rangeText}</p>
            <DeltaLine d={delta(data.totals.clicks, data.previous.clicks)} versus={versus} />
          </section>

          <dl className="stats3">
            <div>
              <dt>Unique visitors</dt>
              <dd>{fmt(data.totals.uniques)}</dd>
              <DeltaLine d={delta(data.totals.uniques, data.previous.uniques)} versus={versus} />
            </div>
            <div>
              <dt>Daily average</dt>
              <dd>{avg < 10 ? avg.toFixed(1) : fmt(Math.round(avg))}</dd>
            </div>
            <div>
              <dt>Best day</dt>
              <dd>{best && best.clicks > 0 ? fmt(best.clicks) : "None"}</dd>
              {best && best.clicks > 0 ? <p className="delta-line">{shortDay(best.day)}</p> : null}
            </div>
          </dl>

          {!hasClicks ? (
            <Empty title="No clicks in this period">Share one of your links, or choose a longer date range.</Empty>
          ) : (
            <>
              <section className="block">
                <div className="block-head">
                  <h2 className="h2">Clicks by day</h2>
                  <Segmented
                    value={view}
                    onChange={setView}
                    label="Chart or table"
                    options={[
                      { value: "chart", label: "Chart" },
                      { value: "table", label: "Table" },
                    ]}
                  />
                </div>
                {view === "chart" ? (
                  <TimeChart key={`${data.range.from}-${data.range.to}`} data={data.daily} />
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Clicks</th>
                        <th scope="col">Unique visitors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.daily].reverse().map((d) => (
                        <tr key={d.day}>
                          <th scope="row">{longDay(d.day)}</th>
                          <td>{fmt(d.clicks)}</td>
                          <td>{fmt(d.uniques)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">Total</th>
                        <td>{fmt(data.totals.clicks)}</td>
                        <td>{fmt(data.totals.uniques)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </section>

              <section className="block">
                <h2 className="h2">Where clicks come from</h2>
                <p className="help">
                  Add <b>?src=</b> and a name to the end of a link when you post it to tag your own campaigns.
                </p>
                <BarList rows={data.sources} />
              </section>

              {!link && data.top_links.length > 1 ? (
                <section className="block">
                  <h2 className="h2">Top links</h2>
                  <BarList
                    rows={data.top_links.map((l) => ({ label: l.code, n: l.clicks }))}
                    labelOf={(code) => codeToCaption.get(code) || code}
                    onPick={setLink}
                  />
                </section>
              ) : null}

              <section className="block">
                <h2 className="h2">Busiest hours</h2>
                {peak >= 0 ? (
                  <p className="help">
                    Most clicks arrive between {hourLabel(peak)} and {hourLabel(peak + 1)}, in your time zone.
                  </p>
                ) : null}
                <HourChart hours={data.hours} />
              </section>

              <section className="block">
                <h2 className="h2">Countries</h2>
                <BarList rows={data.countries} labelOf={countryName} />
              </section>

              <section className="block">
                <h2 className="h2">Devices</h2>
                <BarList rows={data.devices} labelOf={cap} />
              </section>

              <section className="block">
                <h2 className="h2">Operating systems</h2>
                <BarList rows={data.os} />
              </section>
            </>
          )}

          <p className="foot-note">
            Link-preview robots from Facebook, WhatsApp and Telegram are not counted, so these numbers are real people.
          </p>
        </div>
      ) : null}
    </div>
  );
}

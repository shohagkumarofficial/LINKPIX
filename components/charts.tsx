"use client";

import { useMemo, useRef, useState } from "react";
import { fmt, hourLabel, longDay, niceScale, shortDay } from "./format";

/* Charts are plain SVG so nothing extra is downloaded.
   Colors come from CSS variables (see globals.css) so light and dark mode both work. */

export interface DayPoint {
  day: string;
  clicks: number;
  uniques: number;
}

const W = 360;
const H = 208;
const PAD = { l: 36, r: 12, t: 12, b: 26 };

export function TimeChart({ data }: { data: DayPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = data.length;
  const max = Math.max(0, ...data.map((d) => Math.max(d.clicks, d.uniques)));
  const { top, ticks } = useMemo(() => niceScale(max), [max]);

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => PAD.t + ih - (v / top) * ih;

  const path = (key: "clicks" | "uniques") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");

  const labelIdx = useMemo(() => {
    if (n <= 7) return Array.from({ length: n }, (_, i) => i);
    const set = new Set<number>();
    for (let j = 0; j < 5; j++) set.add(Math.round((j * (n - 1)) / 4));
    return [...set];
  }, [n]);

  function pick(clientX: number) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = n <= 1 ? 0 : Math.round(((vx - PAD.l) / iw) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => Math.max(0, (a ?? n) - 1));
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  const act = active !== null ? data[active] : null;
  const last = n - 1;

  return (
    <div>
      <ul className="legend" aria-label="Legend">
        <li>
          <span className="key key-1" aria-hidden="true" />
          Clicks
        </li>
        <li>
          <span className="key key-2" aria-hidden="true" />
          Unique visitors
        </li>
      </ul>

      <div
        className="chart-wrap"
        tabIndex={0}
        role="group"
        aria-label="Daily clicks and unique visitors. Use the left and right arrow keys to read each day."
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="chart"
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "ax-base" : "ax-grid"} />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="ax-text">
                {fmt(t)}
              </text>
            </g>
          ))}

          {labelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === last ? "end" : "middle"}
              className="ax-text"
            >
              {shortDay(data[i].day)}
            </text>
          ))}

          {n > 1 ? (
            <path d={`${path("clicks")} L${x(last).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`} className="area-1" />
          ) : null}
          {n > 1 ? <path d={path("uniques")} className="line line-2" /> : null}
          {n > 1 ? <path d={path("clicks")} className="line line-1" /> : null}

          {act && active !== null ? (
            <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={PAD.t + ih} className="crosshair" />
          ) : null}

          {n > 0 ? (
            <>
              <circle cx={x(active ?? last)} cy={y((act ?? data[last]).uniques)} r="4" className="dot dot-2" />
              <circle cx={x(active ?? last)} cy={y((act ?? data[last]).clicks)} r="4" className="dot dot-1" />
            </>
          ) : null}
        </svg>

        {act && active !== null ? (
          <div
            className={active > n / 2 ? "tip tip-left" : "tip"}
            style={{ left: `${(x(active) / W) * 100}%` }}
            role="status"
          >
            <span className="tip-title">{longDay(act.day)}</span>
            <span className="tip-row">
              <span className="key key-1" aria-hidden="true" />
              <b>{fmt(act.clicks)}</b> clicks
            </span>
            <span className="tip-row">
              <span className="key key-2" aria-hidden="true" />
              <b>{fmt(act.uniques)}</b> unique visitors
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const HW = 360;
const HH = 124;
const HPAD = { l: 4, r: 4, t: 8, b: 22 };

export function HourChart({ hours }: { hours: number[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...hours);
  const peak = max > 0 ? hours.indexOf(max) : -1;

  const slot = (HW - HPAD.l - HPAD.r) / 24;
  const bw = Math.max(4, slot - 3);
  const ih = HH - HPAD.t - HPAD.b;
  const base = HPAD.t + ih;

  const bar = (h: number) => {
    const v = hours[h];
    if (v <= 0 || max <= 0) return "";
    const height = Math.max(3, (v / max) * ih);
    const bx = HPAD.l + h * slot + (slot - bw) / 2;
    const by = base - height;
    const r = Math.min(4, bw / 2, height);
    return `M${bx} ${base} V${by + r} Q${bx} ${by} ${bx + r} ${by} H${bx + bw - r} Q${bx + bw} ${by} ${bx + bw} ${by + r} V${base} Z`;
  };

  const center = (h: number) => HPAD.l + h * slot + slot / 2;

  return (
    <div className="chart-wrap" onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}>
      <svg viewBox={`0 0 ${HW} ${HH}`} className="chart" role="img" aria-label="Clicks by hour of the day">
        <line x1={HPAD.l} x2={HW - HPAD.r} y1={base} y2={base} className="ax-base" />
        {hours.map((_, h) => (
          <path key={h} d={bar(h)} className={h === peak || h === active ? "col col-on" : "col"} />
        ))}
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={h === 0 ? HPAD.l : center(h)} y={HH - 6} textAnchor={h === 0 ? "start" : "middle"} className="ax-text">
            {hourLabel(h)}
          </text>
        ))}
        {hours.map((_, h) => (
          <rect
            key={`hit-${h}`}
            x={HPAD.l + h * slot}
            y={0}
            width={slot}
            height={HH - HPAD.b}
            fill="transparent"
            onPointerEnter={() => setActive(h)}
            onPointerDown={() => setActive(h)}
          />
        ))}
      </svg>

      {active !== null ? (
        <div
          className={`tip ${(center(active) / HW) * 100 < 22 ? "tip-start" : (center(active) / HW) * 100 > 78 ? "tip-end" : "tip-center"}`}
          style={{ left: `${(center(active) / HW) * 100}%` }}
          role="status"
        >
          <span className="tip-title">
            {hourLabel(active)} to {hourLabel(active + 1)}
          </span>
          <span className="tip-row">
            <b>{fmt(hours[active])}</b> {hours[active] === 1 ? "click" : "clicks"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface BucketRow {
  label: string;
  n: number;
}

export function BarList({
  rows,
  limit = 6,
  labelOf,
  onPick,
}: {
  rows: BucketRow[];
  limit?: number;
  labelOf?: (label: string) => string;
  onPick?: (label: string) => void;
}) {
  const [all, setAll] = useState(false);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const max = rows[0]?.n ?? 0;
  const shown = all ? rows : rows.slice(0, limit);

  return (
    <div>
      <ul className="bl">
        {shown.map((r) => {
          const pct = total ? (r.n / total) * 100 : 0;
          const label = labelOf ? labelOf(r.label) : r.label;
          const inner = (
            <>
              <span className="bl-top">
                <span className="bl-label">{label}</span>
                <span className="bl-val">
                  <b>{fmt(r.n)}</b>
                  <span>{pct > 0 && pct < 1 ? "<1" : Math.round(pct)}%</span>
                </span>
              </span>
              <span className="bl-track">
                <span className="bl-fill" style={{ width: `${max ? Math.max(2, (r.n / max) * 100) : 0}%` }} />
              </span>
            </>
          );
          return (
            <li key={r.label}>
              {onPick ? (
                <button type="button" className="bl-item bl-btn" onClick={() => onPick(r.label)}>
                  {inner}
                </button>
              ) : (
                <div className="bl-item">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length > limit ? (
        <button type="button" className="btn-text btn-text-left" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </div>
  );
}

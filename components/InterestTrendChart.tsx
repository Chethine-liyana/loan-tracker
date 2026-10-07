"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { buildInterestSeries, type HistoryRange, type InterestMetric } from "@/lib/interestHistory";
import { formatLKR } from "@/lib/calculations";
import type { Loan, LoanSnapshot } from "@/types";

interface Props {
  loans: Loan[];
  snapshots: LoanSnapshot[];
  title?: string;
}

const TOTAL_COLOR = "#f87171";
const LOAN_COLORS = ["#60a5fa", "#fbbf24", "#34d399", "#a78bfa", "#f472b6", "#22d3ee", "#fb923c"];
const RANGES: HistoryRange[] = ["7D", "1M", "6M", "1Y", "ALL"];

function shortK(n: number): string {
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Math.round(n).toLocaleString("en-US");
}

/** Round the axis bounds outward to a tidy step so ticks read cleanly. */
function niceDomain(min: number, max: number): [number, number] {
  const range = Math.max(max - min, max * 0.05, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(range / 4)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((c) => range / c <= 5) ?? 10 * mag;
  return [Math.max(0, Math.floor((min - range * 0.15) / step) * step), Math.ceil((max + range * 0.15) / step) * step];
}

export default function InterestTrendChart({ loans, snapshots, title }: Props) {
  const [metric, setMetric] = useState<InterestMetric>("DAILY");
  const [range, setRange] = useState<HistoryRange>("1M");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const data = useMemo(
    () => buildInterestSeries(loans, snapshots, range, metric),
    [loans, snapshots, range, metric]
  );

  const labelFor = (l: Loan) => `${l.bank_name}${l.ticket_no ? ` #${l.ticket_no}` : ""}`;
  const colorFor = (i: number) => LOAN_COLORS[i % LOAN_COLORS.length];
  const visibleLoans = loans.filter((l) => !hidden.has(l.id));

  // Zoom the Y axis around the data (like the reference chart) instead of starting at 0.
  const values = data.flatMap((r) => [
    r.total,
    ...visibleLoans.map((l) => r[l.id] as number | null),
  ]).filter((v): v is number => typeof v === "number");
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const domain = niceDomain(min, max);

  const first = data.find((r) => r.total !== null)?.total ?? null;
  const last = [...data].reverse().find((r) => r.total !== null)?.total ?? null;
  const delta = first !== null && last !== null ? last - first : null;
  const unit = metric === "DAILY" ? "/ day" : "/ month";

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pill = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
      active
        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
    }`;

  return (
    <section className="mb-6">
      {title && (
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
          {title}
        </p>
      )}
      <div className="stat-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-900/60 rounded-lg p-0.5">
            <button onClick={() => setMetric("DAILY")} className={pill(metric === "DAILY")}>Daily</button>
            <button onClick={() => setMetric("MONTHLY")} className={pill(metric === "MONTHLY")}>Monthly</button>
          </div>
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-900/60 rounded-lg p-0.5">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} className={pill(range === r)}>
                {r === "ALL" ? "All" : r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {last !== null ? formatLKR(last) : "—"}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{unit} · all accounts combined</span>
          {delta !== null && Math.abs(delta) >= 0.005 && (
            <span className={`text-xs font-semibold ${delta < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {delta < 0 ? "▼" : "▲"} {formatLKR(Math.abs(delta))} over this range
            </span>
          )}
        </div>

        <div style={{ width: "100%", height: 260 }} className="mt-2">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="interestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TOTAL_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={TOTAL_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-gray-500 dark:text-gray-400"
                interval="preserveStartEnd"
                minTickGap={36}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tickFormatter={shortK}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-gray-500 dark:text-gray-400"
                width={48}
                tickLine={false}
                axisLine={false}
                tickCount={5}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as Record<string, number | string | null>;
                  return (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs space-y-0.5">
                      <p className="font-semibold text-gray-900 dark:text-white">{row.label as string}</p>
                      <p style={{ color: TOTAL_COLOR }}>
                        All: {typeof row.total === "number" ? formatLKR(row.total) : "—"}
                      </p>
                      {visibleLoans.map((l) => {
                        const v = row[l.id];
                        if (typeof v !== "number") return null;
                        return (
                          <p key={l.id} style={{ color: colorFor(loans.indexOf(l)) }}>
                            {labelFor(l)}: {formatLKR(v)}
                          </p>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Area
                type="stepAfter"
                dataKey="total"
                stroke={TOTAL_COLOR}
                strokeWidth={2}
                fill="url(#interestFill)"
                isAnimationActive={false}
                dot={false}
              />
              {visibleLoans.map((l) => (
                <Line
                  key={l.id}
                  type="stepAfter"
                  dataKey={l.id}
                  stroke={colorFor(loans.indexOf(l))}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {loans.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {loans.map((l, i) => {
              const off = hidden.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-opacity ${
                    off ? "opacity-40" : ""
                  } border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300`}
                  title={off ? "Show on chart" : "Hide from chart"}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(i) }} />
                  {labelFor(l)}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          Steps happen when a payment is logged or a loan is edited — interest per day = principal × rate ÷ 365.
        </p>
      </div>
    </section>
  );
}

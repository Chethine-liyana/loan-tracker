"use client";

import type { RangePreset } from "@/types/budget";

interface Props {
  preset: RangePreset;
  year: number;
  month: number;
  customFrom: string;
  customTo: string;
  onPresetChange: (p: RangePreset) => void;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
  onCustomFromChange: (d: string) => void;
  onCustomToChange: (d: string) => void;
}

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "LAST_MONTH", label: "Last Month" },
  { value: "THIS_MONTH", label: "This Month" },
  { value: "NEXT_MONTH", label: "Next Month" },
  { value: "THIS_YEAR", label: "This Year" },
  { value: "ALL_TIME", label: "All-Time" },
  { value: "CUSTOM", label: "Custom" },
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function TimeRangeFilter({
  preset, year, month, customFrom, customTo,
  onPresetChange, onYearChange, onMonthChange, onCustomFromChange, onCustomToChange,
}: Props) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  return (
    <div className="sticky top-16 z-20 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm py-2 -mx-1 px-1 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPresetChange(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                preset === p.value
                  ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "CUSTOM" && (
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => onMonthChange(Number(e.target.value))}
              className="input-field py-1.5 text-sm w-auto">
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => onYearChange(Number(e.target.value))}
              className="input-field py-1.5 text-sm w-auto">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-xs text-gray-400">or</span>
            <input type="date" value={customFrom} onChange={(e) => onCustomFromChange(e.target.value)}
              className="input-field py-1.5 text-sm w-auto" />
            <span className="text-xs text-gray-400">→</span>
            <input type="date" value={customTo} onChange={(e) => onCustomToChange(e.target.value)}
              className="input-field py-1.5 text-sm w-auto" />
          </div>
        )}
      </div>
    </div>
  );
}

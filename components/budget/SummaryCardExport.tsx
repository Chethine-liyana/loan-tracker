"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/budget/calculations";

interface Props {
  periodLabel: string;
  income: number;
  expense: number;
  currency: string;
  topCategory?: { name: string; total: number };
}

export default function SummaryCardExport({ periodLabel, income, expense, currency, topCategory }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ref.current, { backgroundColor: null, scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `summary-${periodLabel.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden>
        <div ref={ref} className="w-[380px] rounded-3xl p-7 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white font-sans">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-4">{periodLabel} Summary</p>
          <p className="text-3xl font-bold mb-1">{formatCurrency(income - expense, currency)}</p>
          <p className="text-xs opacity-80 mb-6">Net for the period</p>
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-80">Income</span>
            <span className="font-semibold">{formatCurrency(income, currency)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-80">Expense</span>
            <span className="font-semibold">{formatCurrency(expense, currency)}</span>
          </div>
          {topCategory && (
            <div className="flex justify-between text-sm pt-3 mt-3 border-t border-white/30">
              <span className="opacity-80">Top category</span>
              <span className="font-semibold">{topCategory.name} · {formatCurrency(topCategory.total, currency)}</span>
            </div>
          )}
        </div>
      </div>
      <button onClick={handleDownload} disabled={busy} className="btn-secondary text-xs px-2.5 py-1.5">
        {busy ? "Rendering…" : "📸 Summary Image"}
      </button>
    </div>
  );
}

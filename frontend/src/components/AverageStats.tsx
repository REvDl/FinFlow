import * as React from "react";
import useSWR from "swr";
import { useDashboard } from "@/contexts/DashboardContext";
import { getAverageStats, AverageResponse } from "@/lib/api";
import { TrendingDown, TrendingUp, Loader2 } from "lucide-react";

export function AverageStats() {
  const { currency, dateRange, formatDateForAPI } = useDashboard();


  const { data, isLoading } = useSWR<AverageResponse>(
    [
      "average-stats",
      currency,
      formatDateForAPI(dateRange.start),
      formatDateForAPI(dateRange.end)
    ],
    () => getAverageStats({
      start: dateRange.start,
      end: dateRange.end,
      to_currency: currency
    })
  );

  if (isLoading) return <div className="h-10 w-full animate-pulse bg-gray-50 dark:bg-slate-900 rounded-2xl mt-4" />;

  return (
    <div className="mt-2 flex items-center justify-between rounded-3xl border border-gray-100 bg-white/50 p-4 px-6 dark:border-slate-800 dark:bg-slate-900/50 shadow-sm transition-all">
      <div className="flex gap-8">
        {/* Средний ежедневный расход */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-red-600 dark:text-red-400">
            <TrendingDown className="size-4" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-tighter text-gray-400 dark:text-slate-500">Средний ежедневный расход</p>
            <p className="text-base font-black text-red-600 dark:text-red-400">
              {/* Используем форматирование или просто округляем */}
              {Math.round(data?.average_spending || 0).toLocaleString()} <span className="text-[10px] uppercase opacity-70">{currency}</span>
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-100 dark:bg-slate-800" />

        {/* Средний ежедневный доход */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-tighter text-gray-400 dark:text-slate-500">Средний ежедневный доход</p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {Math.round(data?.average_income || 0).toLocaleString()} <span className="text-[10px] uppercase opacity-70">{currency}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="text-right hidden sm:block">
        <p className="text-[10px] font-bold italic text-gray-300 dark:text-slate-700">
          {data?.days || 0} дн.
        </p>
      </div>
    </div>
  );
}
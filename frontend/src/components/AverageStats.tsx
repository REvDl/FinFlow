import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { getAverageStats, AverageResponse } from "@/lib/api";
import { TrendingDown, TrendingUp } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";

export function AverageStats() {
  const { currency, dateRange, formatDateForAPI } = useDashboard();
  const { isAuthenticated } = useAuth();

  const key = queryKeys.averageStats(
    currency,
    formatDateForAPI(dateRange.start),
    formatDateForAPI(dateRange.end)
  );

  const { data, isLoading } = useQuery<AverageResponse>({
    queryKey: key,
    queryFn: () =>
      getAverageStats({
        start: dateRange.start,
        end: dateRange.end,
        to_currency: currency,
      }),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  if (isLoading)
    return (
      <div className="h-10 w-full animate-pulse bg-gray-50 dark:bg-slate-900 rounded-2xl mt-4" />
    );

  return (
    <div className="mt-2 flex items-center justify-between rounded-3xl border border-gray-100 bg-white/50 p-4 px-6 dark:border-slate-800 dark:bg-slate-900/50 shadow-sm transition-all">
      <div className="flex gap-8">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 text-red-600 dark:text-red-400">
            <TrendingDown className="size-4" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-tighter text-gray-400 dark:text-slate-500">
              Average daily expense
            </p>
            <p className="text-base font-black text-red-600 dark:text-red-400">
              {Math.round(data?.average_spending || 0).toLocaleString()}{" "}
              <span className="text-[10px] uppercase opacity-70">{currency}</span>
            </p>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-100 dark:bg-slate-800" />

        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-4" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-tighter text-gray-400 dark:text-slate-500">
              Average daily income
            </p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {Math.round(data?.average_income || 0).toLocaleString()}{" "}
              <span className="text-[10px] uppercase opacity-70">{currency}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="text-right hidden sm:block">
        <p className="text-[10px] font-bold italic text-gray-300 dark:text-slate-700">
          {data?.days || 0} d.
        </p>
      </div>
    </div>
  );
}

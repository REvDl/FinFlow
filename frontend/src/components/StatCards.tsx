import useSWR from "swr";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { transactionsAPI, TotalResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { AverageStats } from "./AverageStats";

export function StatCards() {
  // Добавляем refreshTicket из контекста
  const { currency, dateRange, formatDateForAPI, refreshTicket } = useDashboard();
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useSWR<TotalResponse>(
    isAuthenticated
      ? [
          "totals",
          currency,
          formatDateForAPI(dateRange.start),
          formatDateForAPI(dateRange.end),
          refreshTicket, // Добавляем тикет в ключ SWR для автообновления
        ]
      : null,
    () =>
      transactionsAPI.getTotal({
        to_currency: currency,
        start: formatDateForAPI(dateRange.start),
        end: formatDateForAPI(dateRange.end),
      })
  );

  const cardStyles = "rounded-3xl border border-gray-100 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm transition-all duration-300";

  if (!isAuthenticated) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className={`${cardStyles} py-4`}>
            <CardContent className="flex items-center gap-4 px-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gray-50 dark:bg-slate-800">
                <Wallet className="size-6 text-gray-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                  Войдите, чтобы увидеть
                </p>
                <p className="mt-1 text-2xl font-black text-gray-500 dark:text-slate-400">--</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className={`${cardStyles} py-4`}>
            <CardContent className="flex items-center justify-center px-4">
              <Spinner className="size-6" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Текущий баланс",
      value: data?.balance ?? 0,
      icon: Wallet,
      color:
        (data?.balance ?? 0) >= 0
          ? "bg-primary/10 text-primary dark:bg-primary/20"
          : "bg-destructive/10 text-destructive dark:bg-destructive/20",
      valueColor:
        (data?.balance ?? 0) >= 0 ? "text-success" : "text-destructive",
    },
    {
      label: "Доходы",
      value: data?.income ?? 0,
      icon: TrendingUp,
      color: "bg-success/10 text-success dark:bg-success/20",
      valueColor: "text-success",
    },
    {
      label: "Расходы",
      value: data?.spending ?? 0,
      icon: TrendingDown,
      color: "bg-destructive/10 text-destructive dark:bg-destructive/20",
      valueColor: "text-destructive",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className={`${cardStyles} group py-6 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <CardContent className="flex items-center gap-4 px-6">
              <div
                className={`flex size-12 items-center justify-center rounded-2xl ${stat.color} transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110`}
              >
                <stat.icon
                  className={`size-6 transition-transform duration-300 group-hover:rotate-6 ${
                    stat.label === "Текущий баланс" &&
                    (stat.value ?? 0) < 0 &&
                    "group-hover:-rotate-12"
                  }`}
                />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                  {stat.label}
                </p>
                <p
                  className={`mt-2 text-3xl font-black tracking-tight ${stat.valueColor} dark:brightness-150 transition-all`}
                >
                  {formatCurrency(stat.value, currency)}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AverageStats />
    </div>
  );
}
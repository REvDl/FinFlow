import * as React from "react";
import { LogOut, Wallet, CalendarIcon, RotateCcw, Sun, Moon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard, Currency } from "@/contexts/DashboardContext";
import { DateRange } from "react-day-picker";

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: "UAH", label: "UAH", symbol: "₴" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "RUB", label: "RUB", symbol: "₽" },
  { value: "CZK", label: "CZK", symbol: "Kč" },
];

export function Header() {
  const { user, logout, setShowAuthModal } = useAuth();
  const { currency, setCurrency, dateRange, setDateRange } = useDashboard();

  // Состояние темной темы
  const [isDark, setIsDark] = React.useState(false);

  // Синхронизация состояния с классом на <html>
  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setIsDark(!isDark);
  };

  const resetToCurrentMonth = () => {
    setDateRange({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    });
  };

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      setDateRange({
        start: range.from,
        end: range.to ?? range.from,
      });
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 dark:bg-slate-950/90 backdrop-blur shadow-sm transition-colors duration-300">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-8">

        {/* Логотип */}
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Wallet className="size-5" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase dark:text-white">
            FinFlow
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Кнопка переключения темы */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            className="rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white"
          >
            {isDark ? (
              <Sun className="size-4 text-yellow-400 fill-yellow-400" />
            ) : (
              <Moon className="size-4 text-slate-600 fill-slate-600" />
            )}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="hidden w-[260px] justify-start rounded-lg border-gray-200 bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 text-left text-xs font-bold uppercase tracking-widest sm:flex"
              >
                <CalendarIcon className="mr-2 size-4 text-indigo-500" />
                {format(dateRange.start, "dd.MM.yyyy")} —{" "}
                {format(dateRange.end, "dd.MM.yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex flex-col dark:bg-slate-950 dark:border-slate-800" align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange.start}
                selected={{ from: dateRange.start, to: dateRange.end }}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                className="dark:bg-slate-950 dark:text-white rounded-md"
              />
              <div className="border-t p-3 bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.95] dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  onClick={resetToCurrentMonth}
                >
                  <RotateCcw className="mr-2 size-3" />
                  Текущий месяц
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v as Currency)}
          >
            <SelectTrigger className="w-[110px] text-xs font-black uppercase tracking-widest dark:bg-slate-900 dark:border-slate-800 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
              {currencies.map((c) => (
                <SelectItem key={c.value} value={c.value} className="dark:text-white dark:focus:bg-slate-800">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {c.symbol}
                    </span>
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-bold text-gray-600 dark:text-slate-400 sm:inline border-r dark:border-slate-800 pr-3 italic">
                {user.username}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="h-8 rounded-lg border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 px-3 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-all active:scale-95"
              >
                <LogOut className="size-4" />
                <span className="ml-1 hidden sm:inline">Выйти</span>
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowAuthModal(true)}>Войти</Button>
          )}
        </div>
      </div>
    </header>
  );
}
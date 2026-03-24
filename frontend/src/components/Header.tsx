import * as React from "react";
import { LogOut, Wallet, CalendarIcon, RotateCcw, Sun, Moon, DownloadCloud, UploadCloud } from "lucide-react";
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
import { transactionsAPI } from "@/lib/api";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast"; // ИМПОРТ ХУКА

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: "UAH", label: "UAH", symbol: "₴" },
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "RUB", label: "RUB", symbol: "₽" },
  { value: "CZK", label: "CZK", symbol: "Kč" },
];

export function Header() {
  const { user, logout, setShowAuthModal } = useAuth();
  const { currency, setCurrency, dateRange, setDateRange, setAllTime, refreshData } = useDashboard();
  const { toast } = useToast(); // ИНИЦИАЛИЗАЦИЯ

  const [isDark, setIsDark] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  // ЛОГИКА ЭКСПОРТА С TOAST
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await transactionsAPI.exportTransactions();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = format(new Date(), "yyyy-MM-dd");
      a.download = `FinFlow_export_${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Экспорт завершен",
        description: "Файл с транзакциями успешно сохранен",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Ошибка экспорта",
        description: "Не удалось сформировать файл для загрузки",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // ЛОГИКА ИМПОРТА С TOAST
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await transactionsAPI.importTransactions(file);
      refreshData();

      toast({
        title: "Импорт успешно выполнен",
        description: result.message || "Ваши транзакции загружены",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Ошибка импорта",
        description: err.message || "Не удалось обработать JSON-файл",
      });
    } finally {
      setIsImporting(false);
      if (event.target) event.target.value = "";
    }
  };

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
      <div className="flex h-16 w-full items-center justify-between gap-2 px-4 md:px-8">

        <div className="flex items-center gap-2 shrink-0 group cursor-pointer">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Wallet className="size-5" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase dark:text-white hidden sm:block">
            FinFlow
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />

          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleImportClick}
              disabled={isImporting}
              title="Импорт транзакций из JSON"
              className={cn(
                "rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white shrink-0 transition-all",
                isImporting && "opacity-50"
              )}
            >
              <UploadCloud className={cn("size-4 text-emerald-500", isImporting && "animate-bounce")} />
            </Button>
          )}

          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExport}
              disabled={isExporting}
              title="Экспорт транзакций в JSON"
              className={cn(
                "rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white shrink-0 transition-all",
                isExporting && "animate-pulse opacity-50"
              )}
            >
              <DownloadCloud className={cn("size-4 text-indigo-500", isExporting && "animate-bounce")} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white shrink-0"
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
                className={cn(
                  "justify-center sm:justify-start rounded-lg border-gray-200 bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 text-xs font-bold uppercase tracking-widest transition-all shrink-0",
                  "w-10 p-0 sm:w-[260px] sm:px-4"
                )}
              >
                <CalendarIcon className="sm:mr-2 size-4 text-indigo-500" />
                <span className="hidden sm:inline whitespace-nowrap">
                  {format(dateRange.start, "dd.MM.yyyy")} — {format(dateRange.end, "dd.MM.yyyy")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 flex flex-col dark:bg-slate-950 dark:border-slate-800" align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange.start}
                selected={{ from: dateRange.start, to: dateRange.end }}
                onSelect={handleDateRangeSelect}
                numberOfMonths={window.innerWidth < 640 ? 1 : 2}
                className="dark:bg-slate-950 dark:text-white rounded-md"
              />
              <div className="flex items-center gap-2 border-t p-3 bg-gray-50/50 dark:bg-slate-900/50 dark:border-slate-800">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.95] dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  onClick={resetToCurrentMonth}
                >
                  <RotateCcw className="mr-2 size-3" />
                  Текущий месяц
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.95] dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  onClick={setAllTime}
                >
                  За все время
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v as Currency)}
          >
            <SelectTrigger className="w-auto min-w-[75px] md:w-[110px] text-xs font-black uppercase tracking-widest dark:bg-slate-900 dark:border-slate-800 dark:text-white shrink-0 px-2 md:px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
              {currencies.map((c) => (
                <SelectItem key={c.value} value={c.value} className="dark:text-white dark:focus:bg-slate-800">
                  <span className="flex items-center gap-1 md:gap-2">
                    <span className="font-mono text-muted-foreground">{c.symbol}</span>
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {user ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden lg:inline text-sm font-bold text-gray-600 dark:text-slate-400 border-r dark:border-slate-800 pr-3 italic">
                {user.username}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="h-8 rounded-lg border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 px-2 md:px-3 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-100 transition-all active:scale-95 shrink-0"
              >
                <LogOut className="size-4" />
                <span className="ml-1 hidden sm:inline">Выйти</span>
              </Button>
            </div>
          ) : (
            <Button
              className="shrink-0"
              onClick={() => setShowAuthModal(true)}
            >
              Войти
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
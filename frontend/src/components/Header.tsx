import * as React from "react";
import { LogOut, Wallet, CalendarIcon, RotateCcw, Sun, Moon, DownloadCloud, UploadCloud, MoreHorizontal } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard, Currency } from "@/contexts/DashboardContext";
import { transactionsAPI } from "@/lib/api";
import { invalidateAfterTransactionChange, queryKeys } from "@/lib/queryKeys";
import { CURRENCIES, getCurrencySymbol } from "@/lib/currencies";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

export function Header() {
  const { user, logout, setShowAuthModal } = useAuth();
  const queryClient = useQueryClient();
  const { currency, setCurrency, dateRange, setDateRange, setAllTime } = useDashboard();
  const { toast } = useToast();

  const [isDark, setIsDark] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

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
        title: "Export completed",
        description: "The transactions file was saved successfully",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Export error",
        description: "Failed to generate the file for download",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await transactionsAPI.importTransactions(file);
      invalidateAfterTransactionChange(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });

      toast({
        title: "Import completed",
        description: result.message || "Your transactions were uploaded",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Import error",
        description: err.message || "Failed to process the JSON file",
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
      <div className="flex h-16 w-full items-center justify-between gap-1 px-2 sm:gap-2 sm:px-4 md:px-8">

        <div className="flex items-center gap-2 shrink-0 group cursor-pointer">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Wallet className="size-5" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase dark:text-white hidden sm:block">
            FinFlow
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2 md:gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />

          {user && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="More actions"
                  className="rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white shrink-0 sm:hidden"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="flex w-48 flex-col gap-1 p-2 dark:bg-slate-950 dark:border-slate-800 sm:hidden"
                align="end"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="w-full justify-start gap-2 font-bold uppercase tracking-widest text-[10px]"
                >
                  <UploadCloud className={cn("size-4 text-emerald-500", isImporting && "animate-bounce")} />
                  Import JSON
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full justify-start gap-2 font-bold uppercase tracking-widest text-[10px]"
                >
                  <DownloadCloud className={cn("size-4 text-indigo-500", isExporting && "animate-bounce")} />
                  Export JSON
                </Button>
              </PopoverContent>
            </Popover>
          )}

          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleImportClick}
              disabled={isImporting}
              title="Import transactions from JSON"
              className={cn(
                "hidden rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white shrink-0 transition-all sm:inline-flex",
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
              title="Export transactions to JSON"
              className={cn(
                "hidden rounded-lg border border-gray-200 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-white shrink-0 transition-all sm:inline-flex",
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
                  Current month
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.95] dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  onClick={setAllTime}
                >
                  All time
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={currency}
            onValueChange={(v) => setCurrency(v as Currency)}
          >
            <SelectTrigger className="relative h-9 w-10 shrink-0 justify-center px-0 text-xs font-black tracking-normal dark:bg-slate-900 dark:border-slate-800 dark:text-white [&>svg]:hidden sm:w-auto sm:min-w-[75px] sm:justify-between sm:gap-2 sm:px-3 sm:tracking-widest sm:[&>svg]:block md:w-[110px]">
            <span className="font-mono text-sm sm:hidden">
              {getCurrencySymbol(currency)}
            </span>
            <div className="hidden items-center gap-1 sm:flex">
              <span className="font-mono text-sm">{getCurrencySymbol(currency)}</span>
              <span className="uppercase">{currency}</span>
            </div>
          </SelectTrigger>
            <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
              {CURRENCIES.map((c) => (
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
                <span className="ml-1 hidden sm:inline">Log out</span>
              </Button>
            </div>
          ) : (
            <Button
              className="shrink-0"
              onClick={() => setShowAuthModal(true)}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
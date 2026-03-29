import React, { createContext, useContext, useState, useCallback } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { transactionsAPI } from "@/lib/api";

export type Currency = "UAH" | "USD" | "EUR" | "RUB" | "CZK";
export type TransactionFilter = "all" | "income" | "spending";

interface DateRange {
  start: Date;
  end: Date;
}

interface DashboardContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  setAllTime: () => Promise<void>;
  transactionFilter: TransactionFilter;
  setTransactionFilter: (filter: TransactionFilter) => void;
  selectedCategoryId: number | null;
  setSelectedCategoryId: (id: number | null) => void;
  formatDateForAPI: (date: Date) => string;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("UAH");
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );

  const formatDateForAPI = useCallback((date: Date) => format(date, "yyyy-MM-dd"), []);

  const setAllTime = async () => {
    try {
      const response = await transactionsAPI.getExtremeDates();

      if (response && response.min_data && response.max_data) {
        const { min_data, max_data } = response;

        const parseStrict = (dateStr: string) => {
          const cleanStr = dateStr.trim().split(" ")[0] || dateStr;
          const [y, m, d] = cleanStr.split(/[-T ]/).map(Number);
          return new Date(y, m - 1, d, 12, 0, 0);
        };

        const start = parseStrict(min_data);
        const end = parseStrict(max_data);

        if (start && end) {
          setDateRange({ start, end });
        }
      }
    } catch (error) {
      console.error("Ошибка фронта:", error);
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        currency,
        setCurrency,
        dateRange,
        setDateRange,
        setAllTime,
        transactionFilter,
        setTransactionFilter,
        selectedCategoryId,
        setSelectedCategoryId,
        formatDateForAPI,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}

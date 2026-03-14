import React, { createContext, useContext, useState } from "react";
import { startOfMonth, endOfMonth, format } from "date-fns";

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

  const formatDateForAPI = (date: Date) => format(date, "yyyy-MM-dd");

  return (
    <DashboardContext.Provider
      value={{
        currency,
        setCurrency,
        dateRange,
        setDateRange,
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

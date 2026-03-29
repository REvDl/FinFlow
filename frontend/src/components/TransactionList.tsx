import { useEffect, useRef, useCallback, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useDashboard, TransactionFilter } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  transactionsAPI,
  categoriesAPI,
  PaginatedTransactions,
  Transaction,
} from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency, cn } from "@/lib/utils";
import { TransactionModal } from "./TransactionModal";

const PAGE_SIZE = 20;

export function TransactionList() {
  const {
    transactionFilter,
    setTransactionFilter,
    selectedCategoryId,
    dateRange,
    formatDateForAPI,
  } = useDashboard();

  const { isAuthenticated } = useAuth();
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const start = formatDateForAPI(dateRange.start);
  const end = formatDateForAPI(dateRange.end);

  const listQueryKey = queryKeys.transactionsInfinite(
    transactionFilter,
    selectedCategoryId,
    start,
    end
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: listQueryKey,
    initialPageParam: undefined as
      | { cursor_time: string; cursor_id: number }
      | undefined,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = {
        type: transactionFilter,
        limit: PAGE_SIZE,
        start,
        end,
      };
      if (pageParam) {
        params.cursor_time = pageParam.cursor_time;
        params.cursor_id = pageParam.cursor_id;
      }
      if (selectedCategoryId) {
        return categoriesAPI.getTransactions(selectedCategoryId, params);
      }
      return transactionsAPI.list(params);
    },
    getNextPageParam: (lastPage: PaginatedTransactions) =>
      lastPage.has_more && lastPage.next_cursor
        ? lastPage.next_cursor
        : undefined,
    enabled: isAuthenticated,
  });

  const transactions =
    data?.pages.flatMap((page) => page.items) ?? [];
  const hasMore = !!hasNextPage;
  const isLoadingMore = isFetchingNextPage;

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasMore, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });
    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  const handleFilterChange = (value: string) => {
    setTransactionFilter(value as TransactionFilter);
  };

  const cardBaseStyles =
    "flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors duration-300";

  if (!isAuthenticated) {
    return (
      <Card className={cardBaseStyles}>
        <CardHeader className="pb-3">
          <CardTitle className="dark:text-white">История операций</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground dark:text-slate-500">
            Войдите, чтобы увидеть операции
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cardBaseStyles}>
        <CardHeader className="flex-row items-center justify-between gap-4 pb-3">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-slate-400">
            История операций
          </CardTitle>
          <Tabs value={transactionFilter} onValueChange={handleFilterChange}>
            <TabsList className="dark:bg-slate-950 dark:border dark:border-slate-800">
              <TabsTrigger
                value="all"
                className="text-[10px] font-black uppercase tracking-widest dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
              >
                Все
              </TabsTrigger>
              <TabsTrigger
                value="income"
                className="text-[10px] font-black uppercase tracking-widest dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
              >
                Доходы
              </TabsTrigger>
              <TabsTrigger
                value="spending"
                className="text-[10px] font-black uppercase tracking-widest dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white"
              >
                Расходы
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-[calc(100vh-400px)] min-h-[300px]">
            <div className="px-6 pb-6">
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground dark:text-slate-500">
                  No transactions found
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {transactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      onClick={() => setSelectedTransaction(transaction)}
                      className="group flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4 text-left transition-all hover:bg-gray-100 dark:border-slate-800/50 dark:bg-slate-950/50 dark:hover:bg-slate-800"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-slate-100">
                            {transaction.name}
                          </span>
                          {transaction.category_name && (
                            <span className="rounded-full bg-secondary/50 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground dark:text-slate-400">
                              {transaction.category_name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground dark:text-slate-500">
                          {format(
                            new Date(transaction.created_at),
                            "MMM d, yyyy"
                          )}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "font-mono text-sm font-black transition-all",
                          transaction.transaction_type === "income"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {transaction.transaction_type === "income" ? "+" : "-"}
                        {formatCurrency(
                          transaction.price,
                          transaction.currency
                        )}
                      </span>
                    </button>
                  ))}
                  <div ref={loadMoreRef} className="flex justify-center py-4">
                    {isLoadingMore && <Spinner className="size-5" />}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <TransactionModal
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        onSuccess={() => setSelectedTransaction(null)}
      />
    </>
  );
}

import { useState, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Plus, X, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { categoriesAPI, transactionsAPI, Category, TotalResponse } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

export function CategoryList() {
  const { mutate } = useSWRConfig();
  const { isAuthenticated } = useAuth();
  const {
    selectedCategoryId,
    setSelectedCategoryId,
    currency,
    dateRange,
    formatDateForAPI,
    refreshTicket,
    refreshData,
  } = useDashboard();

  const [newCategory, setNewCategory] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем фиксированный ключ "categories"
  // Это гарантирует, что все компоненты смотрят в одну корзину
  const { data: categories, isLoading } = useSWR<Category[]>(
    isAuthenticated ? "categories" : null,
    () => categoriesAPI.list()
  );

  const { data: totals } = useSWR<TotalResponse>(
    isAuthenticated
      ? [
          "totals",
          currency,
          formatDateForAPI(dateRange.start),
          formatDateForAPI(dateRange.end),
          refreshTicket,
        ]
      : null,
    () =>
      transactionsAPI.getTotal({
        to_currency: currency,
        start: formatDateForAPI(dateRange.start),
        end: formatDateForAPI(dateRange.end),
      })
  );

  const categoryAmounts = totals?.categories ?? {};

  const sortedCategories = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => {
      const amountA = categoryAmounts[a.name] ?? 0;
      const amountB = categoryAmounts[b.name] ?? 0;
      return amountB - amountA;
    });
  }, [categories, categoryAmounts]);

  const maxSpending = Math.max(...Object.values(categoryAmounts), 1);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    setIsAdding(true);

    try {
      await categoriesAPI.create({ name: newCategory.trim() });
      setNewCategory("");
      // Мгновенно обновляем ключ "categories"
      await mutate("categories");
      refreshData();
    } catch (err) {
      console.error("Add failed:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    // 1. Оптимистичное удаление из UI
    // Мы сразу выкидываем категорию из кеша, не дожидаясь сервера
    mutate(
      "categories",
      (current: Category[] | undefined) => current?.filter((c) => c.id !== id),
      false
    );

    try {
      await categoriesAPI.delete(id);
      // 2. После успеха синхронизируемся с сервером начисто
      await mutate("categories");
      refreshData();

      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      // Если сервак ответил ошибкой — вернем всё как было
      mutate("categories");
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Card className="flex flex-col rounded-3xl border border-gray-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2 dark:text-white text-[12px] font-black uppercase tracking-widest">
            <Tag className="size-4 text-indigo-500" />
            Категории
          </span>
          {selectedCategoryId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategoryId(null)}
              className="h-6 px-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
            >
              Сбросить
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pb-4">
        <div className="flex gap-2">
          <Input
            placeholder="Новая категория"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            className="h-8 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder:text-slate-600"
          />
          <Button
            size="sm"
            onClick={handleAddCategory}
            disabled={isAdding || !newCategory.trim()}
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isAdding ? <Spinner className="size-3" /> : <Plus className="size-4" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner className="size-5" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-2">
            <div className="flex flex-col gap-2">
              {sortedCategories.map((category) => {
                const amount = categoryAmounts[category.name] ?? 0;
                const percentage = maxSpending > 0 ? (amount / maxSpending) * 100 : 0;
                const isSelected = selectedCategoryId === category.id;

                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(isSelected ? null : category.id)}
                    className={cn(
                      "group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all",
                      "bg-gray-50/50 border-gray-100 hover:bg-gray-100 dark:bg-slate-950/50 dark:border-slate-800 dark:hover:bg-slate-800",
                      isSelected && "border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 dark:text-slate-200">{category.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-100">
                          {formatCurrency(amount, currency)}
                        </span>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-opacity group-hover:opacity-100 opacity-0"
                        >
                          <X className="size-3.5 text-gray-400 hover:text-red-500" />
                        </div>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-1 dark:bg-slate-800" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
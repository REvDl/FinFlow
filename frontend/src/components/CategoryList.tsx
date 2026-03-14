import { useState } from "react";
import useSWR, { mutate } from "swr";
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
  const { isAuthenticated } = useAuth();
  const {
    selectedCategoryId,
    setSelectedCategoryId,
    currency,
    dateRange,
    formatDateForAPI,
  } = useDashboard();
  const [newCategory, setNewCategory] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Получаем список категорий
  const { data: categories, isLoading } = useSWR<Category[]>(
    isAuthenticated ? "categories" : null,
    () => categoriesAPI.list()
  );

  // Получаем суммы по категориям
  const { data: totals } = useSWR<TotalResponse>(
    isAuthenticated
      ? [
          "totals",
          currency,
          formatDateForAPI(dateRange.start),
          formatDateForAPI(dateRange.end),
        ]
      : null,
    () =>
      transactionsAPI.getTotal({
        to_currency: currency,
        start: formatDateForAPI(dateRange.start),
        end: formatDateForAPI(dateRange.end),
      })
  );

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    setIsAdding(true);
    try {
      await categoriesAPI.create({ name: newCategory.trim() });
      mutate("categories");
      setNewCategory("");
    } catch (err) {
      console.error("Failed to add category:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await categoriesAPI.delete(id);
      mutate("categories");
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
    }
  };

  const categoryAmounts = totals?.categories ?? {};
  const maxSpending = Math.max(...Object.values(categoryAmounts), 1);

  // Стили для темной темы
  const cardStyles = "flex flex-col rounded-3xl border border-gray-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors duration-300";
  const inputStyles = "h-8 dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder:text-slate-600";

  if (!isAuthenticated) {
    return (
      <Card className={cardStyles}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base dark:text-white">
            <Tag className="size-4" />
            Категории
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground dark:text-slate-500">
            Войдите, чтобы посмотреть категории
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardStyles}>
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
            className={inputStyles}
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
        ) : categories?.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground dark:text-slate-500">
            Категорий пока нет
          </p>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 pr-2">
              {categories?.map((category) => {
                const amount = categoryAmounts[category.name] ?? 0;
                const percentage = maxSpending > 0 ? (amount / maxSpending) * 100 : 0;
                const isSelected = selectedCategoryId === category.id;

                return (
                  <button
                    key={category.id}
                    onClick={() =>
                      setSelectedCategoryId(isSelected ? null : category.id)
                    }
                    className={cn(
                      "group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all",
                      "bg-gray-50/50 border-gray-100 hover:bg-gray-100",
                      "dark:bg-slate-950/50 dark:border-slate-800 dark:hover:bg-slate-800",
                      isSelected && "border-indigo-500 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700 dark:text-slate-200">
                        {category.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-400">
                          {formatCurrency(amount, currency)}
                        </span>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCategory(category.id);
                          }}
                          className="opacity-0 transition-opacity group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md"
                        >
                          <X className="size-3.5 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400" />
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={percentage}
                      className="h-1 dark:bg-slate-800"
                    />
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
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Tag, Pencil, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { categoriesAPI, transactionsAPI, Category } from "@/lib/api";
import { queryKeys, invalidateAfterCategoryChange } from "@/lib/queryKeys";
import { formatCurrency, cn } from "@/lib/utils";

export function CategoryList() {
  const queryClient = useQueryClient();
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
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const { data: categories, isLoading } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => categoriesAPI.list(),
    enabled: isAuthenticated,
  });

  const totalsQueryKey = queryKeys.totals(
    currency,
    formatDateForAPI(dateRange.start),
    formatDateForAPI(dateRange.end)
  );

  const { data: totals } = useQuery({
    queryKey: totalsQueryKey,
    queryFn: () =>
      transactionsAPI.getTotal({
        to_currency: currency,
        start: formatDateForAPI(dateRange.start),
        end: formatDateForAPI(dateRange.end),
      }),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => categoriesAPI.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      queryClient.invalidateQueries({ queryKey: ["totals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesAPI.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories });
      const previous = queryClient.getQueryData<Category[]>(queryKeys.categories);
      queryClient.setQueryData<Category[]>(queryKeys.categories, (old) =>
        old?.filter((c) => c.id !== id) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.categories, ctx.previous);
      }
    },
    onSuccess: (_data, id) => {
      if (selectedCategoryId === id) {
        setSelectedCategoryId(null);
      }
      // Не инвалидируем список категорий: оптимистичный кэш уже верен, повторный GET
      // может вернуть устаревшие данные и дать визуальный «откат» строки.
      invalidateAfterCategoryChange(queryClient, { skipCategories: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      categoriesAPI.update(id, { name }),
    onSuccess: async () => {
      await invalidateAfterCategoryChange(queryClient);
      setEditingCategoryId(null);
      setEditingCategoryName("");
    },
  });

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
      await createMutation.mutateAsync(newCategory.trim());
      setNewCategory("");
    } catch (err) {
      console.error("Add failed:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCategory = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleStartEditCategory = (id: number, name: string) => {
    setEditingCategoryId(id);
    setEditingCategoryName(name);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategoryId) return;
    const normalizedName = editingCategoryName.trim();
    if (!normalizedName) return;

    try {
      await updateMutation.mutateAsync({ id: editingCategoryId, name: normalizedName });
    } catch (err) {
      console.error("Rename failed:", err);
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
            disabled={isAdding || !newCategory.trim() || createMutation.isPending}
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
                      {editingCategoryId === category.id ? (
                        <Input
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveEditCategory();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCancelEdit();
                            }
                          }}
                          className="h-7 w-[65%] text-sm dark:bg-slate-900 dark:border-slate-700"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold text-gray-700 dark:text-slate-200">
                          {category.name}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-500 dark:text-slate-100">
                          {formatCurrency(amount, currency)}
                        </span>
                        {editingCategoryId === category.id ? (
                          <>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEditCategory();
                              }}
                              className="p-1 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                            >
                              <Check className="size-3.5 text-emerald-500" />
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                              className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700"
                            >
                              <X className="size-3.5 text-gray-400" />
                            </div>
                          </>
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditCategory(category.id, category.name);
                            }}
                            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-md transition-opacity group-hover:opacity-100 opacity-0"
                          >
                            <Pencil className="size-3.5 text-gray-400 hover:text-indigo-500" />
                          </div>
                        )}
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

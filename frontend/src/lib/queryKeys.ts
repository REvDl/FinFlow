import type { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  user: ["user"] as const,
  categories: ["categories"] as const,
  diagramData: (currency: string, start: string, end: string) =>
    ["diagram-data", currency, start, end] as const,
  totals: (currency: string, start: string, end: string) =>
    ["totals", currency, start, end] as const,
  averageStats: (currency: string, start: string, end: string) =>
    ["averageStats", currency, start, end] as const,
  transactionsInfinite: (
    filter: string,
    categoryId: number | null,
    start: string,
    end: string
  ) => ["transactions", "infinite", filter, categoryId, start, end] as const,
} as const;

export function invalidateAfterTransactionChange(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["transactions", "infinite"] });
  queryClient.invalidateQueries({ queryKey: ["diagram-data"] });
  queryClient.invalidateQueries({ queryKey: ["totals"] });
  queryClient.invalidateQueries({ queryKey: ["averageStats"] });
}

export function invalidateAfterCategoryChange(
  queryClient: QueryClient,
  options?: { skipCategories?: boolean }
) {
  if (!options?.skipCategories) {
    queryClient.invalidateQueries({ queryKey: queryKeys.categories });
  }
  queryClient.invalidateQueries({ queryKey: ["totals"] });
  queryClient.invalidateQueries({ queryKey: ["diagram-data"] });
  queryClient.invalidateQueries({ queryKey: ["averageStats"] });
  queryClient.invalidateQueries({ queryKey: ["transactions", "infinite"] });
}

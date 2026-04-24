import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import { CalendarIcon, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Transaction,
  transactionsAPI,
  categoriesAPI,
  PaginatedTransactions,
} from "@/lib/api";
import { queryKeys, invalidateAfterTransactionChange } from "@/lib/queryKeys";
import { CURRENCIES, CURRENCY_VALUES } from "@/lib/currencies";
import { cn } from "@/lib/utils";

const transactionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().positive("Amount must be positive"),
  currency: z.enum(CURRENCY_VALUES),
  category_id: z.number().positive("Category is required"),
  transaction_type: z.enum(["income", "spending"]),
  description: z.string().optional(),
  created_at: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionModalProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TransactionModal({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: TransactionModalProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(
    transaction ? new Date(transaction.created_at) : new Date()
  );

  const { data: categories } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => categoriesAPI.list(),
  });

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      name: "",
      price: 0,
      currency: "UAH",
      category_id: 0,
      transaction_type: "spending",
      description: "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: TransactionFormData & { created_at?: string }) => {
      if (transaction) {
        return transactionsAPI.update(transaction.id, payload);
      }
      return transactionsAPI.create(payload);
    },
    onSuccess: () => {
      invalidateAfterTransactionChange(queryClient);
      onSuccess();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => transactionsAPI.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["transactions", "infinite"] });
      const previousQueries = queryClient.getQueriesData<
        InfiniteData<PaginatedTransactions>
      >({ queryKey: ["transactions", "infinite"] });

      queryClient.setQueriesData<InfiniteData<PaginatedTransactions>>(
        { queryKey: ["transactions", "infinite"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((t) => t.id !== id),
            })),
          };
        }
      );

      return { previousQueries };
    },
    onError: (_err, _id, ctx) => {
      ctx?.previousQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      onSuccess();
    },
    onSettled: () => {
      invalidateAfterTransactionChange(queryClient);
    },
  });

  useEffect(() => {
    if (transaction) {
      form.reset({
        name: transaction.name,
        price: transaction.price,
        currency: transaction.currency as (typeof CURRENCY_VALUES)[number],
        category_id: transaction.category_id,
        transaction_type: transaction.transaction_type,
        description: transaction.description || "",
      });
      setDate(new Date(transaction.created_at));
    } else {
      form.reset({
        name: "",
        price: 0,
        currency: "UAH",
        category_id: categories?.[0]?.id || 0,
        transaction_type: "spending",
        description: "",
      });
      setDate(new Date());
    }
  }, [transaction, categories, form]);

  const handleSubmit = async (data: TransactionFormData) => {
    try {
      const payload = {
        ...data,
        created_at: date ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
      };
      await saveMutation.mutateAsync(payload);
    } catch (err) {
      console.error("Failed to save transaction:", err);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  };

  const isDeleting = deleteMutation.isPending;
  const isSaving = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit Transaction" : "New Transaction"}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? "Update the transaction details"
              : "Add a new transaction"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          <Tabs
            value={form.watch("transaction_type")}
            onValueChange={(v) =>
              form.setValue(
                "transaction_type",
                v as "income" | "spending"
              )
            }
          >
            <TabsList className="w-full">
              <TabsTrigger value="spending" className="flex-1">
                Expense
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                Income
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Transaction name"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="price">Amount</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...form.register("price", { valueAsNumber: true })}
              />
              {form.formState.errors.price && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) =>
                  form.setValue("currency", v as (typeof CURRENCY_VALUES)[number])
                }
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currencyOption) => (
                    <SelectItem key={currencyOption.value} value={currencyOption.value}>
                      {currencyOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={String(form.watch("category_id"))}
              onValueChange={(v) => form.setValue("category_id", Number(v))}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Add a description"
              {...form.register("description")}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {transaction && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Spinner />
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    Delete
                  </>
                )}
              </Button>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Spinner />
              ) : transaction ? (
                "Save changes"
              ) : (
                "Add transaction"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

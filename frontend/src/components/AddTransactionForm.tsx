import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { transactionsAPI, categoriesAPI } from "@/lib/api";
import { queryKeys, invalidateAfterTransactionChange } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

const currencies = ["UAH", "USD", "EUR", "RUB", "CZK"] as const;

const schema = z.object({
  name: z.string().min(1, "Required"),
  price: z.number().positive("Must be positive"),
  currency: z.enum(currencies),
  category_id: z.number().positive("Select a category"),
  transaction_type: z.enum(["income", "spending"]),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function AddTransactionForm() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { currency } = useDashboard();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isOpen, setIsOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => categoriesAPI.list(),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: transactionsAPI.create,
    onSuccess: () => {
      invalidateAfterTransactionChange(queryClient);
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      price: 0,
      currency: "UAH",
      category_id: 0,
      transaction_type: "spending",
      description: "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    try {
      await createMutation.mutateAsync({
        ...data,
        currency: data.currency || currency,
        created_at: date ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
      });

      form.reset({
        name: "",
        price: 0,
        currency: "UAH",
        category_id: categories?.[0]?.id || 0,
        transaction_type: "spending",
        description: "",
      });
      setDate(new Date());
    } catch (err) {
      console.error("Failed to add transaction:", err);
    }
  };

  const cardStyles =
    "rounded-3xl border border-gray-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors duration-300";
  const labelStyles =
    "text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400";
  const inputStyles =
    "dark:bg-slate-950 dark:border-slate-800 dark:text-white dark:placeholder:text-slate-600";

  if (!isAuthenticated) {
    return (
      <Card className={cardStyles}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base dark:text-white">
            <Plus className="size-4" />
            New Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground dark:text-slate-500">
            Sign in to add transactions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardStyles}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base dark:text-white">
          <Plus className="size-4" />
          New Entry
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          <Tabs
            value={form.watch("transaction_type")}
            onValueChange={(v) =>
              form.setValue("transaction_type", v as "income" | "spending")
            }
          >
            <TabsList className="w-full dark:bg-slate-950 dark:border dark:border-slate-800 p-1">
              <TabsTrigger
                value="spending"
                className="flex-1 text-[10px] font-black uppercase tracking-widest"
              >
                Expense
              </TabsTrigger>
              <TabsTrigger
                value="income"
                className="flex-1 text-[10px] font-black uppercase tracking-widest"
              >
                Income
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-1.5">
            <Label className={labelStyles}>Description</Label>
            <Input
              className={inputStyles}
              placeholder="Transaction name"
              {...form.register("name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className={labelStyles}>Amount</Label>
              <Input
                className={inputStyles}
                type="number"
                step="0.01"
                {...form.register("price", { valueAsNumber: true })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className={labelStyles}>Currency</Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v as any)}
              >
                <SelectTrigger className={inputStyles}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c} className="dark:text-white">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelStyles}>Category</Label>
            <Select
              value={String(form.watch("category_id") || "")}
              onValueChange={(v) => form.setValue("category_id", Number(v))}
            >
              <SelectTrigger className={inputStyles}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-950 dark:border-slate-800">
                {categories?.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={String(c.id)}
                    className="dark:text-white"
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className={labelStyles}>Date</Label>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 justify-start text-left font-medium",
                    inputStyles
                  )}
                >
                  <CalendarIcon className="mr-2 size-4 text-indigo-500" />
                  {date ? format(date, "dd.MM.yyyy") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 dark:bg-slate-950 dark:border-slate-800"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setIsOpen(false);
                  }}
                  className="dark:bg-slate-950 dark:text-white"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            type="submit"
            className="mt-2 h-11 w-full rounded-xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-700"
            disabled={form.formState.isSubmitting || createMutation.isPending}
          >
            {form.formState.isSubmitting || createMutation.isPending ? (
              <Spinner />
            ) : (
              <>
                <Plus className="mr-2 size-4" /> Add
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

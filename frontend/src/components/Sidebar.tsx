import { AddTransactionForm } from "./AddTransactionForm";
import { CategoryList } from "./CategoryList";

export function Sidebar() {
  return (
    <aside className="flex w-full min-w-[220px] max-w-[480px] resize-x flex-col gap-4 overflow-auto border-r border-gray-100 dark:border-slate-800 lg:shrink-0 transition-colors duration-300">
      <AddTransactionForm />
      <CategoryList />
    </aside>
  );
}
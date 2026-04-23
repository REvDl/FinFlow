import { Header } from "./Header";
import { StatCards } from "./StatCards";
import { Sidebar } from "./Sidebar";
import { TransactionList } from "./TransactionList";
import { DashboardCharts } from "./DashboardCharts";

export function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <Header />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <StatCards />
        <div className="flex flex-1 flex-col gap-6 lg:flex-row">
          <Sidebar />
          <TransactionList />
        </div>
        <DashboardCharts />
      </main>
    </div>
  );
}
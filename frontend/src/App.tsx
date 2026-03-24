import { SWRConfig } from "swr";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardProvider } from "./contexts/DashboardContext";
import { AuthModal } from "./components/AuthModal";
import { Dashboard } from "./components/Dashboard";
import { Toaster } from "@/components/ui/toaster"; // 1. Импортируем Toaster

export function App() {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      <AuthProvider>
        <DashboardProvider>
          <Dashboard />
          <AuthModal />
          <Toaster /> {/* 2. Добавляем его сюда */}
        </DashboardProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
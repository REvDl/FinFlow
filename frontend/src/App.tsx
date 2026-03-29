import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardProvider } from "./contexts/DashboardContext";
import { AuthModal } from "./components/AuthModal";
import { Dashboard } from "./components/Dashboard";
import { Toaster } from "@/components/ui/toaster";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DashboardProvider>
          <Dashboard />
          <AuthModal />
          <Toaster />
        </DashboardProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

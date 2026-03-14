import { SWRConfig } from "swr";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardProvider } from "./contexts/DashboardContext";
import { AuthModal } from "./components/AuthModal";
import { Dashboard } from "./components/Dashboard";

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
        </DashboardProvider>
      </AuthProvider>
    </SWRConfig>
  );
}

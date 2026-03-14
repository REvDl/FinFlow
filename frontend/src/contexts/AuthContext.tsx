import React, { createContext, useContext, useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { authAPI, User, setStoredRefreshToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const {
    data: user,
    error,
    isLoading,
  } = useSWR<User | null>(
    "user",
    async (): Promise<User | null> => {
      try {
        return await authAPI.getCurrentUser();
      } catch {
        return null;
      }
    },
    {}
  );

  const login = useCallback(async (username: string, password: string) => {
    const data = await authAPI.login({ username, password });
    if (data?.tokens?.refresh_token) {
      setStoredRefreshToken(data.tokens.refresh_token);
    }
    await mutate("user");
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      await authAPI.register({ username, password });
      const data = await authAPI.login({ username, password });
      if (data?.tokens?.refresh_token) {
        setStoredRefreshToken(data.tokens.refresh_token);
      }
      await mutate("user");
    },
    []
  );

  const logout = useCallback(async () => {
    await authAPI.logout();
    setStoredRefreshToken(null);
    await mutate("user", null);
  }, []);

  const isAuthenticated = !error && !!user;

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        showAuthModal,
        setShowAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

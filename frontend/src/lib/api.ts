const API_BASE = "/api";

// Храним refresh_token в памяти для продления сессии (без изменения бэкенда)
let storedRefreshToken: string | null = null;
export function setStoredRefreshToken(token: string | null) {
  storedRefreshToken = token;
}
export function getStoredRefreshToken(): string | null {
  return storedRefreshToken;
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  _retry?: boolean;
}

async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, _retry, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...fetchOptions.headers,
    },
  });

  if (response.status === 401 && !_retry) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      try {
        const refreshUrl = `${API_BASE}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`;
        const refreshRes = await fetch(refreshUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        const refreshData = await refreshRes.json().catch(() => ({}));
        if (refreshRes.ok && refreshData.refresh_token) {
          setStoredRefreshToken(refreshData.refresh_token);
          return fetchAPI<T>(endpoint, { ...options, _retry: true });
        }
      } catch {
        setStoredRefreshToken(null);
      }
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// Auth API
export interface AuthResponse {
  user: User;
  tokens: { access_token: string; refresh_token: string; token_type?: string };
}
export const authAPI = {
  register: (data: { username: string; password: string }) =>
    fetchAPI<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
    fetchAPI<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () => fetchAPI("/auth/logout", { method: "POST" }),

  getCurrentUser: () => fetchAPI<User>("/user/"),
};

// Categories API
export const categoriesAPI = {
  list: () => fetchAPI<Category[]>("/categories/"),

  create: (data: { name: string }) =>
    fetchAPI<Category>("/categories/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: { name: string }) =>
    fetchAPI<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchAPI(`/categories/${id}`, { method: "DELETE" }),

  getTransactions: (
    id: number,
    params?: {
      cursor_time?: string;
      cursor_id?: number;
      limit?: number;
      start?: string;
      end?: string;
    }
  ) =>
    fetchAPI<PaginatedTransactions>(`/categories/${id}/transactions`, {
      params,
    }),
};

// Transactions API
export const transactionsAPI = {
  getTotal: (params: {
    to_currency: string;
    start?: string;
    end?: string;
  }) => fetchAPI<TotalResponse>("/transaction/total", { params }),

  list: (params?: {
    type?: "all" | "income" | "spending";
    cursor_time?: string;
    cursor_id?: number;
    limit?: number;
    start?: string;
    end?: string;
  }) => fetchAPI<PaginatedTransactions>("/transaction/", { params }),

  create: (data: CreateTransactionData) =>
    fetchAPI<Transaction>("/transaction/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<CreateTransactionData>) =>
    fetchAPI<Transaction>(`/transaction/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchAPI(`/transaction/${id}`, { method: "DELETE" }),

  get: (id: number) => fetchAPI<Transaction>(`/transaction/${id}`),
};

// Types
export interface User {
  id: number;
  username: string;
}

export interface Category {
  id: number;
  name: string;
  total_spending?: number;
}

export interface Transaction {
  id: number;
  name: string;
  price: number;
  currency: string;
  category_id: number;
  category_name?: string;
  transaction_type: "income" | "spending";
  description?: string;
  created_at: string;
}

export interface CreateTransactionData {
  name: string;
  price: number;
  currency: string;
  category_id: number;
  transaction_type: "income" | "spending";
  description?: string;
  created_at?: string;
}

export interface PaginatedTransactions {
  items: Transaction[];
  /** Бэкенд возвращает курсор в виде объекта */
  next_cursor?: { cursor_time: string; cursor_id: number };
  next_cursor_time?: string;
  next_cursor_id?: number;
  has_more: boolean;
}

export interface CategoryBreakdown {
  category_id: number;
  category_name: string;
  amount: number;
}

export interface TotalResponse {
  balance: number;
  income: number;
  spending: number;
  currency: string;
  /** Бэкенд возвращает категории как объект имя → сумма (только расходы) */
  categories?: Record<string, number>;
  category_breakdown?: CategoryBreakdown[];
}

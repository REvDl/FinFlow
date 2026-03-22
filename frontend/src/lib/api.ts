// @/lib/api.ts

const API_BASE = "/api";

// Храним refresh_token в памяти для продления сессии
let storedRefreshToken: string | null = null;
export function setStoredRefreshToken(token: string | null) {
  storedRefreshToken = token;
}
export function getStoredRefreshToken(): string | null {
  return storedRefreshToken;
}

// Переменные для управления очередью запросов при обновлении токена
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  _retry?: boolean;
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

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

  // Логика обновления токена при 401
  if (response.status === 401 && !_retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => fetchAPI<T>(endpoint, { ...options, _retry: true }))
        .catch((err) => Promise.reject(err));
    }

    isRefreshing = true;
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

        if (refreshRes.ok && refreshData.tokens) {
          setStoredRefreshToken(refreshData.tokens.refresh_token);
          isRefreshing = false;
          processQueue(null, refreshData.tokens.access_token);
          return fetchAPI<T>(endpoint, { ...options, _retry: true });
        }
      } catch (err) {
        isRefreshing = false;
        processQueue(err, null);
        setStoredRefreshToken(null);
        throw err;
      }
    }
    isRefreshing = false;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ СРЕДНЕГО ЗНАЧЕНИЯ ---
export const getAverageStats = async (params: { start: any; end: any; to_currency: string }) => {
  const toISODate = (date: any) => {
    if (!date) return undefined;
    const d = new Date(date);
    return isNaN(d.getTime()) ? date : d.toISOString().split('T')[0];
  };

  return fetchAPI<AverageResponse>("/transaction/average", {
    params: {
      start: toISODate(params.start),
      end: toISODate(params.end),
      to_currency: params.to_currency,
    },
  });
};

// --- API ОБЪЕКТЫ ---

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

  getExtremeDates: () =>
    fetchAPI<{ min_data: string; max_data: string }>("/transaction/all_time"),

  // МЕТОД ДЛЯ ЭКСПОРТА JSON
  exportTransactions: async () => {
    // Используем прямой fetch, так как fetchAPI настроен на .json()
    const url = `${API_BASE}/transaction/export`;
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Export Error: ${response.status}`);
    }

    return response.blob(); // Возвращаем файл как бинарный объект
  },
};

// --- ТИПЫ ДАННЫХ ---

export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  user: User;
  tokens: { access_token: string; refresh_token: string; token_type?: string };
}

export interface Category {
  id: number;
  name: string;
  total_spending?: number;
}

export interface AverageResponse {
  average_spending: number;
  average_income: number;
  days: number;
  to_currency: string;
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
  categories?: Record<string, number>;
  category_breakdown?: CategoryBreakdown[];
}
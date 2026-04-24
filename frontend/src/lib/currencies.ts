export const CURRENCY_VALUES = ["UAH", "USD", "EUR", "PLN", "CZK", "RUB"] as const;

export type CurrencyCode = (typeof CURRENCY_VALUES)[number];

const CURRENCY_META: Record<CurrencyCode, { label: string; symbol: string }> = {
  UAH: { label: "UAH", symbol: "₴" },
  USD: { label: "USD", symbol: "$" },
  EUR: { label: "EUR", symbol: "€" },
  PLN: { label: "PLN", symbol: "zł" },
  CZK: { label: "CZK", symbol: "Kč" },
  RUB: { label: "RUB", symbol: "₽" },
};

export const CURRENCIES = CURRENCY_VALUES.map((value) => ({
  value,
  label: CURRENCY_META[value].label,
  symbol: CURRENCY_META[value].symbol,
}));

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = Object.fromEntries(
  CURRENCIES.map((currency) => [currency.value, currency.symbol])
) as Record<CurrencyCode, string>;

export function getCurrencySymbol(code: string): string {
  return (CURRENCY_SYMBOLS as Record<string, string>)[code] ?? code;
}

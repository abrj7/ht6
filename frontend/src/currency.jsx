import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Static snapshot rates relative to 1 USD (base). Not live-updated — just
// "roughly now" so the UI can show any major currency. Flags are emoji.
export const CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar", rate: 1 },
  { code: "EUR", symbol: "€", flag: "🇪🇺", name: "Euro", rate: 0.92 },
  { code: "GBP", symbol: "£", flag: "🇬🇧", name: "British Pound", rate: 0.79 },
  { code: "INR", symbol: "₹", flag: "🇮🇳", name: "Indian Rupee", rate: 83.2 },
  { code: "JPY", symbol: "¥", flag: "🇯🇵", name: "Japanese Yen", rate: 150 },
  { code: "CAD", symbol: "C$", flag: "🇨🇦", name: "Canadian Dollar", rate: 1.36 },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", name: "Australian Dollar", rate: 1.52 },
  { code: "CNY", symbol: "¥", flag: "🇨🇳", name: "Chinese Yuan", rate: 7.2 },
  { code: "AED", symbol: "د.إ", flag: "🇦🇪", name: "UAE Dirham", rate: 3.67 },
];

const BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));
const STORAGE_KEY = "yonder-currency";

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState(() => {
    if (typeof window === "undefined") return "USD";
    return window.localStorage.getItem(STORAGE_KEY) || "USD";
  });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, code);
  }, [code]);

  const value = useMemo(() => {
    const active = BY_CODE[code] || BY_CODE.USD;
    // JPY/INR read better with no decimals.
    const decimals = active.code === "JPY" || active.code === "INR" ? 0 : 2;
    const convert = (usd) => (Number.isFinite(usd) ? usd * active.rate : usd);
    const fmt = (usd, dp) => {
      if (!Number.isFinite(usd)) return "—";
      const v = convert(usd);
      return `${active.symbol}${v.toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      })}`;
    };
    // format = currency-appropriate decimals; formatInt = whole numbers (for the
    // big dashboard/map figures that were shown without cents).
    const format = (usd) => fmt(usd, decimals);
    const formatInt = (usd) => fmt(usd, 0);
    return { code, setCode, currency: active, convert, format, formatInt };
  }, [code]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext) || {
    code: "USD",
    setCode: () => {},
    currency: BY_CODE.USD,
    convert: (usd) => usd,
    format: (usd) => (Number.isFinite(usd) ? `$${usd.toFixed(2)}` : "—"),
    formatInt: (usd) => (Number.isFinite(usd) ? `$${Math.round(usd)}` : "—"),
  };
}

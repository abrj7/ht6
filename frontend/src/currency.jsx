import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Static snapshot rates relative to 1 USD (base). Not live-updated — just
// "roughly now" so the UI can show any major world currency. Flags are emoji.
// `decimals` overrides the default (2); zero-decimal currencies (JPY, KRW…)
// set it to 0, three-decimal (KWD, BHD) to 3.
export const CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar", rate: 1 },
  { code: "EUR", symbol: "€", flag: "🇪🇺", name: "Euro", rate: 0.92 },
  { code: "GBP", symbol: "£", flag: "🇬🇧", name: "British Pound", rate: 0.79 },
  { code: "JPY", symbol: "¥", flag: "🇯🇵", name: "Japanese Yen", rate: 150, decimals: 0 },
  { code: "CNY", symbol: "¥", flag: "🇨🇳", name: "Chinese Yuan", rate: 7.2 },
  { code: "CHF", symbol: "Fr", flag: "🇨🇭", name: "Swiss Franc", rate: 0.88 },
  { code: "CAD", symbol: "C$", flag: "🇨🇦", name: "Canadian Dollar", rate: 1.36 },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", name: "Australian Dollar", rate: 1.52 },
  { code: "NZD", symbol: "NZ$", flag: "🇳🇿", name: "New Zealand Dollar", rate: 1.64 },
  { code: "HKD", symbol: "HK$", flag: "🇭🇰", name: "Hong Kong Dollar", rate: 7.81 },
  { code: "SGD", symbol: "S$", flag: "🇸🇬", name: "Singapore Dollar", rate: 1.34 },
  { code: "INR", symbol: "₹", flag: "🇮🇳", name: "Indian Rupee", rate: 83.2 },
  { code: "KRW", symbol: "₩", flag: "🇰🇷", name: "South Korean Won", rate: 1360, decimals: 0 },
  { code: "TWD", symbol: "NT$", flag: "🇹🇼", name: "Taiwan Dollar", rate: 32 },
  { code: "THB", symbol: "฿", flag: "🇹🇭", name: "Thai Baht", rate: 36 },
  { code: "MYR", symbol: "RM", flag: "🇲🇾", name: "Malaysian Ringgit", rate: 4.7 },
  { code: "IDR", symbol: "Rp", flag: "🇮🇩", name: "Indonesian Rupiah", rate: 16000, decimals: 0 },
  { code: "PHP", symbol: "₱", flag: "🇵🇭", name: "Philippine Peso", rate: 58 },
  { code: "VND", symbol: "₫", flag: "🇻🇳", name: "Vietnamese Dong", rate: 25000, decimals: 0 },
  { code: "PKR", symbol: "₨", flag: "🇵🇰", name: "Pakistani Rupee", rate: 278 },
  { code: "BDT", symbol: "৳", flag: "🇧🇩", name: "Bangladeshi Taka", rate: 117 },
  { code: "SEK", symbol: "kr", flag: "🇸🇪", name: "Swedish Krona", rate: 10.5 },
  { code: "NOK", symbol: "kr", flag: "🇳🇴", name: "Norwegian Krone", rate: 10.7 },
  { code: "DKK", symbol: "kr", flag: "🇩🇰", name: "Danish Krone", rate: 6.87 },
  { code: "ISK", symbol: "kr", flag: "🇮🇸", name: "Icelandic Króna", rate: 138, decimals: 0 },
  { code: "PLN", symbol: "zł", flag: "🇵🇱", name: "Polish Złoty", rate: 3.95 },
  { code: "CZK", symbol: "Kč", flag: "🇨🇿", name: "Czech Koruna", rate: 23 },
  { code: "HUF", symbol: "Ft", flag: "🇭🇺", name: "Hungarian Forint", rate: 360, decimals: 0 },
  { code: "RON", symbol: "lei", flag: "🇷🇴", name: "Romanian Leu", rate: 4.57 },
  { code: "TRY", symbol: "₺", flag: "🇹🇷", name: "Turkish Lira", rate: 32.5 },
  { code: "RUB", symbol: "₽", flag: "🇷🇺", name: "Russian Ruble", rate: 92 },
  { code: "UAH", symbol: "₴", flag: "🇺🇦", name: "Ukrainian Hryvnia", rate: 40 },
  { code: "ILS", symbol: "₪", flag: "🇮🇱", name: "Israeli Shekel", rate: 3.7 },
  { code: "AED", symbol: "د.إ", flag: "🇦🇪", name: "UAE Dirham", rate: 3.67 },
  { code: "SAR", symbol: "﷼", flag: "🇸🇦", name: "Saudi Riyal", rate: 3.75 },
  { code: "QAR", symbol: "ر.ق", flag: "🇶🇦", name: "Qatari Riyal", rate: 3.64 },
  { code: "KWD", symbol: "د.ك", flag: "🇰🇼", name: "Kuwaiti Dinar", rate: 0.307, decimals: 3 },
  { code: "EGP", symbol: "£", flag: "🇪🇬", name: "Egyptian Pound", rate: 47 },
  { code: "ZAR", symbol: "R", flag: "🇿🇦", name: "South African Rand", rate: 18.5 },
  { code: "NGN", symbol: "₦", flag: "🇳🇬", name: "Nigerian Naira", rate: 1500, decimals: 0 },
  { code: "KES", symbol: "KSh", flag: "🇰🇪", name: "Kenyan Shilling", rate: 130 },
  { code: "BRL", symbol: "R$", flag: "🇧🇷", name: "Brazilian Real", rate: 5.1 },
  { code: "MXN", symbol: "Mex$", flag: "🇲🇽", name: "Mexican Peso", rate: 17 },
  { code: "ARS", symbol: "$", flag: "🇦🇷", name: "Argentine Peso", rate: 900, decimals: 0 },
  { code: "CLP", symbol: "$", flag: "🇨🇱", name: "Chilean Peso", rate: 950, decimals: 0 },
  { code: "COP", symbol: "$", flag: "🇨🇴", name: "Colombian Peso", rate: 3900, decimals: 0 },
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
    // Per-currency decimals (0 for yen/won/etc, 3 for dinar), default 2.
    const decimals = Number.isInteger(active.decimals) ? active.decimals : 2;
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

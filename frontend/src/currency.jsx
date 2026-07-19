// USD-only formatting. No conversion, no picker, no static rates.
export function useCurrency() {
  return {
    format: (usd) => (Number.isFinite(usd) ? `$${usd.toFixed(2)}` : "—"),
    formatInt: (usd) => (Number.isFinite(usd) ? `$${Math.round(usd)}` : "—"),
  };
}

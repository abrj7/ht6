import { useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useAuthApi } from "../auth.js";

const CATEGORIES = [
  { value: "food_delivery", label: "Food delivery" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "shopping", label: "Shopping" },
  { value: "gaming", label: "Gaming" },
  { value: "transport", label: "Transport" },
];

const formatCategory = (value) => {
  return CATEGORIES.find((item) => item.value === value)?.label || value.replaceAll("_", " ");
};

export default function SpendInputForm({ onSpendUpdated }) {
  const { isAuthenticated, loginWithRedirect, isLoading: authLoading } = useAuth0();
  const { fetchAuth } = useAuthApi();
  const [category, setCategory] = useState("food_delivery");
  const [amount, setAmount] = useState("0.00");
  const [merchant, setMerchant] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const parsedAmount = Number(amount);
  const canSubmit = parsedAmount > 0 && Boolean(category);
  const note = useMemo(() => {
    return `Add a spend record for ${formatCategory(category)} to update Chexy totals.`;
  }, [category]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (!isAuthenticated) {
      return loginWithRedirect();
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetchAuth("/api/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, amount: parsedAmount, merchant: merchant || "Manual entry" }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to submit spend");
      }

      setStatus({ type: "success", message: `Recorded $${parsedAmount.toFixed(2)} for ${formatCategory(category)}.` });
      setAmount("0.00");
      setMerchant("");
      onSpendUpdated?.();
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Unable to save spend." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel spend-panel" aria-label="Manual spend entry">
      <div className="panel-head">
        <span className="micro-label">Chexy spend</span>
        <span className="micro-label">manual input</span>
      </div>
      <form className="spend-form" onSubmit={handleSubmit}>
        <label className="spend-field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="spend-field">
          <span>Amount</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </label>

        <label className="spend-field">
          <span>Merchant</span>
          <input
            type="text"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
            placeholder="UberEats, Netflix, etc."
          />
        </label>

        <div className="spend-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={!canSubmit || loading || authLoading}
          >
            {loading ? "Saving..." : "Save spend"}
          </button>
          <p className="spend-note">
            {isAuthenticated
              ? note
              : authLoading
              ? "Checking authentication..."
              : "Log in to submit spend and keep it tied to your Auth0 profile."}
          </p>
        </div>
      </form>
      {status && (
        <div className={`spend-status spend-status--${status.type}`} role="status">
          {status.message}
        </div>
      )}
    </section>
  );
}

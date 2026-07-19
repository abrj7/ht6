import { useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useAuthApi } from "../auth.js";
import { AUTH_CONFIGURED } from "../authConfig.js";

export default function SpendInputForm({ onSpendUpdated, goals = [] }) {
  const { isAuthenticated, loginWithRedirect, isLoading: authLoading, user } = useAuth0();
  const { fetchAuth } = useAuthApi();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [merchant, setMerchant] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // Spend categories come from the user's own goals so logged spend maps to a
  // real bucket. De-duped, order preserved.
  const categories = useMemo(
    () => [...new Set(goals.map((g) => g.category).filter(Boolean))],
    [goals]
  );

  // Keep the selected category valid as goals change.
  useEffect(() => {
    if (categories.length && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  const parsedAmount = Number(amount);
  const canSubmit = parsedAmount > 0 && Boolean(category);
  const note = useMemo(() => {
    if (!categories.length) return "Add a goal above, then log spend against it.";
    return category ? `Log spend for ${category} to update your progress.` : "";
  }, [category, categories.length]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    // Only force a login when Auth0 is actually configured. In demo mode we
    // post unauthenticated (backend accepts it with its guard disabled).
    if (AUTH_CONFIGURED && !isAuthenticated) {
      return loginWithRedirect();
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetchAuth("/api/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          amount: parsedAmount,
          merchant: merchant || "Manual entry",
          userId: isAuthenticated && user?.sub ? user.sub : "demo",
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to submit spend");
      }

      setStatus({ type: "success", message: `Recorded $${parsedAmount.toFixed(2)} for ${category}.` });
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
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={categories.length === 0}
          >
            {categories.length === 0 ? (
              <option value="">Add a goal first</option>
            ) : (
              categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            )}
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
            {!AUTH_CONFIGURED
              ? note
              : isAuthenticated
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

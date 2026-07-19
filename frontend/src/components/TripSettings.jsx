import { useState } from "react";
import { newGoalId } from "../tripConfig.js";

// Manage the user's own saving goals: name a spend/saving category, pick where
// it should take them, and how much they can redirect each month. Add, edit,
// remove. Parent persists per-profile and refetches the board.
export default function TripSettings({ goals, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ category: "", destination: "", amount: "" });

  const addGoal = () => {
    const category = draft.category.trim();
    const destination = draft.destination.trim();
    const amount = Number(draft.amount);
    if (!category || !destination || !(amount > 0)) return;
    onChange([...goals, { id: newGoalId(), category, destination, amount }]);
    setDraft({ category: "", destination: "", amount: "" });
  };

  const removeGoal = (id) => onChange(goals.filter((g) => g.id !== id));

  const editGoal = (id, patch) =>
    onChange(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  return (
    <section className="panel trip-settings" aria-label="Your saving goals">
      <div className="panel-head">
        <span className="micro-label">Your goals</span>
        <button
          type="button"
          className="trip-settings__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Done" : "Manage"}
        </button>
      </div>

      {!open ? (
        <p className="trip-settings__summary">
          {goals.length === 0
            ? "No goals yet. Hit Manage to add your first destination."
            : `${goals.length} goal${goals.length === 1 ? "" : "s"}: ${goals
                .map((g) => `${g.category} → ${g.destination}`)
                .join(", ")}`}
        </p>
      ) : (
        <div className="trip-settings__form">
          {goals.length > 0 && (
            <ul className="goal-list">
              {goals.map((g) => (
                <li key={g.id} className="goal-row">
                  <input
                    className="goal-row__cat"
                    value={g.category}
                    aria-label="Category"
                    onChange={(e) => editGoal(g.id, { category: e.target.value })}
                  />
                  <input
                    className="goal-row__dest"
                    value={g.destination}
                    aria-label="Destination"
                    onChange={(e) => editGoal(g.id, { destination: e.target.value })}
                  />
                  <input
                    className="goal-row__amt"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    value={g.amount}
                    aria-label="Monthly amount"
                    onChange={(e) => editGoal(g.id, { amount: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    className="goal-row__del"
                    onClick={() => removeGoal(g.id)}
                    title="Remove goal"
                    aria-label={`Remove ${g.category}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="goal-add">
            <span className="micro-label">Add a goal</span>
            <input
              type="text"
              aria-label="New goal category"
              autoComplete="off"
              placeholder="Category, e.g. Coffee, Rideshare…"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            />
            <input
              type="text"
              aria-label="New goal destination"
              autoComplete="off"
              placeholder="Destination, e.g. Lisbon, Portugal…"
              value={draft.destination}
              onChange={(e) => setDraft((d) => ({ ...d, destination: e.target.value }))}
            />
            <input
              type="number"
              min="1"
              inputMode="decimal"
              aria-label="New goal monthly amount"
              placeholder="$ / month…"
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") addGoal();
              }}
            />
            <button type="button" className="button button--primary" onClick={addGoal}>
              Add goal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

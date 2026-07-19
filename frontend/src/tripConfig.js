// User-defined saving goals. Each goal = a spend/saving bucket the user names,
// a destination they want it to fund, and a monthly amount they can redirect.
// Goals are stored per-user (Auth0 sub) in localStorage, so a fresh account
// starts empty and the shared "demo" sandbox keeps its showcase.

let idSeq = 0;
export function newGoalId() {
  idSeq += 1;
  return `g-${Date.now()}-${idSeq}`;
}

// Showcase goals for the logged-out demo sandbox only.
export const DEMO_GOALS = [
  { id: "demo-1", category: "Food delivery", destination: "Banff, AB", amount: 150 },
  { id: "demo-2", category: "Subscriptions", destination: "Montreal, QC", amount: 60 },
  { id: "demo-3", category: "Shopping", destination: "Tofino, BC", amount: 120 },
  { id: "demo-4", category: "Gaming", destination: "Paris, France", amount: 80 },
  { id: "demo-5", category: "Transport", destination: "Blue Mountain, ON", amount: 90 },
];

const STORAGE_PREFIX = "yonder-goals-v1";
const keyFor = (userId) => `${STORAGE_PREFIX}::${userId || "demo"}`;

export function loadGoals(userId) {
  if (typeof window === "undefined") {
    return userId && userId !== "demo" ? [] : [...DEMO_GOALS];
  }
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    /* fall through to defaults */
  }
  // No stored goals yet: demo gets the showcase, a real user starts blank.
  return userId && userId !== "demo" ? [] : [...DEMO_GOALS];
}

export function saveGoals(userId, goals) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(goals));
  } catch {
    /* storage blocked — goals just won't persist */
  }
}

// Backend spend category slug from a free-text label ("Concert tickets" ->
// "concert_tickets") so manual spend + goals share a key.
export function slugify(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

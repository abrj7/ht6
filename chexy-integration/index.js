import express from "express";
import cors from "cors";
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// Person D owns this file and everything in /chexy-integration.
// Exposes GET /spend-summary - see docs/PRD.md section 12 for the contract.
// IMPORTANT: sandbox/synthetic data only - no real account linking or money movement.
// Chexy docs are TBD - confirm exact API shape before wiring real integration.

// The month the demo treats as "now" (matches the synthetic dataset's latest month).
const CURRENT_MONTH = "2026-07";

// Honest, transparent heuristics: the share of each category's monthly spend a
// user could realistically redirect (you'd still eat, still commute, etc.).
const RECOVERABLE_RATES = {
  food_delivery: 0.6,
  subscriptions: 0.8,
  shopping: 0.5,
  gaming: 0.7,
  transport: 0.3,
};

const round2 = (n) => Math.round(n * 100) / 100;

app.get("/spend-summary", (req, res) => {
  const userId = req.query.userId || "demo";
  const allTransactions = JSON.parse(
    readFileSync(new URL("./data/mockTransactions.json", import.meta.url))
  );

  // Scope to one profile. Untagged seed rows belong to the "demo" sandbox, so
  // the demo view keeps the rich showcase while a real logged-in user (their
  // Auth0 sub) starts from a clean, empty history.
  const transactions = allTransactions.filter((t) => (t.userId || "demo") === userId);

  // Group all transactions by category, tracking per-month totals for trends.
  const byCategory = {};
  for (const t of transactions) {
    if (!byCategory[t.category]) byCategory[t.category] = { all: [], monthTotals: {} };
    const month = t.date.slice(0, 7); // "YYYY-MM"
    byCategory[t.category].all.push(t);
    byCategory[t.category].monthTotals[month] =
      (byCategory[t.category].monthTotals[month] || 0) + t.amount;
  }

  const categories = Object.entries(byCategory).map(([name, { all, monthTotals }]) => {
    // Contract: monthlyTotal = current month's total (field name unchanged).
    const monthlyTotal = round2(monthTotals[CURRENT_MONTH] || 0);

    const trend = Object.keys(monthTotals)
      .sort()
      .map((month) => ({ month, total: round2(monthTotals[month]) }));

    const recoverableRate = RECOVERABLE_RATES[name] ?? 0.5;

    // Only ship the current month's transactions, newest first, to keep payloads small.
    const currentMonthTxns = all
      .filter((t) => t.date.startsWith(CURRENT_MONTH))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      name,
      monthlyTotal,
      trend,
      recoverableRate,
      recoverableSpend: round2(monthlyTotal * recoverableRate),
      avgTransaction: currentMonthTxns.length
        ? round2(monthlyTotal / currentMonthTxns.length)
        : 0,
      transactionCount: currentMonthTxns.length,
      transactions: currentMonthTxns,
    };
  });

  const totalMonthly = round2(categories.reduce((sum, c) => sum + c.monthlyTotal, 0));
  const totalRecoverable = round2(categories.reduce((sum, c) => sum + c.recoverableSpend, 0));

  res.json({
    categories,
    summary: { totalMonthly, totalRecoverable, month: CURRENT_MONTH },
  });
});

app.post("/transactions", (req, res) => {
  const transaction = req.body;
  if (!transaction || typeof transaction !== "object") {
    return res.status(400).json({ error: "invalid request body" });
  }

  const { userId, category, amount, merchant, date } = transaction;
  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "category required" });
  }
  const spendAmount = Number(amount);
  if (!Number.isFinite(spendAmount) || spendAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  const transactionDate = typeof date === "string" && new Date(date).toString() !== "Invalid Date"
    ? date.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const transactions = JSON.parse(
    readFileSync(new URL("./data/mockTransactions.json", import.meta.url))
  );
  transactions.push({
    category: category.trim(),
    amount: Math.round(spendAmount * 100) / 100,
    date: transactionDate,
    merchant: merchant ? String(merchant).trim() : "Manual entry",
    userId: userId || "demo",
  });
  writeFileSync(
    new URL("./data/mockTransactions.json", import.meta.url),
    JSON.stringify(transactions, null, 2)
  );

  res.status(201).json({ status: "ok", transactionCount: transactions.length });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.CHEXY_API_KEY ? "chexy" : "mock" });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`chexy-integration running on :${PORT}`));

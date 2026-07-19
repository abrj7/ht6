import express from "express";
import cors from "cors";
import "dotenv/config";
import { readFileSync } from "fs";

const app = express();
app.use(cors());

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
  const transactions = JSON.parse(
    readFileSync(new URL("./data/mockTransactions.json", import.meta.url))
  );

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

app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.CHEXY_API_KEY ? "chexy" : "mock" });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`chexy-integration running on :${PORT}`));

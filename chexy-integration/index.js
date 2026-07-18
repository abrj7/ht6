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

app.get("/spend-summary", (req, res) => {
  const transactions = JSON.parse(
    readFileSync(new URL("./data/mockTransactions.json", import.meta.url))
  );

  const categories = {};
  for (const t of transactions) {
    if (!categories[t.category]) categories[t.category] = { name: t.category, monthlyTotal: 0, transactions: [] };
    categories[t.category].monthlyTotal += t.amount;
    categories[t.category].transactions.push(t);
  }

  res.json({ categories: Object.values(categories) });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.CHEXY_API_KEY ? "chexy" : "mock" });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`chexy-integration running on :${PORT}`));

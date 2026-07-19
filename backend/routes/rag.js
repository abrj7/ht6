// RAG agent owns this file: natural-language hotel search over Stay22 data.
// Mounted at /api/ask - see docs/PRD.md section 12 once implemented.
import { Router } from "express";
import { searchRag } from "../rag/index.js";

const router = Router();

router.post("/", (req, res) => {
  const { query, city } = req.body ?? {};
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query required" });
  }

  const start = Date.now();
  try {
    const result = searchRag({ query: query.trim(), city });
    res.json({ ...result, tookMs: Date.now() - start });
  } catch (err) {
    console.error("[rag]", err);
    res.status(500).json({ error: "search failed", detail: String(err.message ?? err) });
  }
});

export default router;

// RAG agent owns this file: natural-language hotel search over Stay22 data.
// Mounted at /api/ask - see docs/PRD.md section 12 once implemented.
import { Router } from "express";

const router = Router();

router.post("/", (req, res) => {
  res.status(501).json({ error: "RAG search not implemented yet" });
});

export default router;

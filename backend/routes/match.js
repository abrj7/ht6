// Hotel-Tinder agent owns this file: swipe deck + persona proxy to ai-service.
// Mounted at /api/match.
import { Router } from "express";

const router = Router();

router.get("/deck", (req, res) => {
  res.status(501).json({ error: "match deck not implemented yet" });
});

export default router;

// Nowcast agent owns this file: hotel-market economic nowcast.
// Mounted at /api/nowcast.
import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.status(501).json({ error: "nowcast not implemented yet" });
});

export default router;

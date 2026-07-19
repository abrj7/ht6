// Nowcast agent owns this file: hotel-market economic nowcast.
// Mounted at /api/nowcast.
import { Router } from "express";
import { startCollector } from "../nowcast/collector.js";
import { buildNowcastResponse } from "../nowcast/indices.js";

const router = Router();

startCollector();

router.get("/", (_req, res) => {
  try {
    res.json(buildNowcastResponse());
  } catch (err) {
    console.error("[nowcast]", err);
    res.status(500).json({ error: "nowcast computation failed" });
  }
});

export default router;

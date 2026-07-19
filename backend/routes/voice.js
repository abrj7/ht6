// Voice agent owns this file: ElevenLabs TTS proxy (key stays server-side).
// Mounted at /api/voice.
import { Router } from "express";

const router = Router();

router.post("/tts", (req, res) => {
  res.status(501).json({ error: "voice proxy not implemented yet" });
});

export default router;

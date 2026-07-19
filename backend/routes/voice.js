// Voice agent owns this file: ElevenLabs TTS proxy (key stays server-side).
// Mounted at /api/voice.
import { Router } from "express";

const router = Router();

const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel"
const MAX_TTS_CHARS = 600;

function hasKey() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

// GET /api/voice/status -> which TTS tier the frontend should expect.
router.get("/status", (req, res) => {
  res.json({ provider: hasKey() ? "elevenlabs" : "browser" });
});

// POST /api/voice/tts { text } -> audio/mpeg stream, or 503 { fallback: true }
// when no ElevenLabs key is configured (frontend uses browser speechSynthesis).
router.post("/tts", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "text required" });
  }
  if (!hasKey()) {
    return res.status(503).json({ fallback: true, provider: "browser" });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const upstream = await fetch(`${ELEVENLABS_URL}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, MAX_TTS_CHARS),
        model_id: "eleven_turbo_v2_5",
      }),
    });

    if (!upstream.ok) {
      // Bad key / quota / rate limit — tell the frontend to use the browser tier.
      return res.status(503).json({ fallback: true, provider: "browser" });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    // Node's fetch gives a web ReadableStream; pipe chunks through as they land.
    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error("voice/tts upstream error:", err.message ?? err);
    if (!res.headersSent) {
      res.status(503).json({ fallback: true, provider: "browser" });
    } else {
      res.end();
    }
  }
});

export default router;

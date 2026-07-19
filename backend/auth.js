import { auth } from "express-oauth2-jwt-bearer";
import { getDb } from "./mongoClient.js";

const authConfigured = Boolean(process.env.AUTH0_AUDIENCE && process.env.AUTH0_DOMAIN);

const jwtCheck = authConfigured
  ? auth({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
    })
  : (req, res, next) => next();

export function authMiddleware() {
  return jwtCheck;
}

export async function ensureUserProfile(req, res, next) {
  try {
    const auth0UserId = req.auth?.payload?.sub;
    if (!auth0UserId) {
      return authConfigured
        ? res.status(401).json({ error: "Missing authenticated user" })
        : next();
    }

    const db = await getDb();
    if (!db) {
      return next();
    }

    const users = db.collection("users");
    const profile = {
      auth0UserId,
      email: req.auth.payload.email || null,
      name: req.auth.payload.name || null,
      picture: req.auth.payload.picture || null,
      updatedAt: new Date(),
    };

    await users.updateOne(
      { auth0UserId },
      { $set: profile, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to persist user profile" });
  }
}

import { auth } from "express-oauth2-jwt-bearer";
import { getDb } from "./mongoClient.js";

const authConfigured = Boolean(process.env.AUTH0_AUDIENCE && process.env.AUTH0_DOMAIN);
// Force strict auth (reject every unauthenticated request) by setting
// REQUIRE_AUTH=true. Default: optional — a request WITH a bearer token is
// validated, one WITHOUT is allowed through as a demo user. This lets the
// frontend run in demo mode (no Auth0 Client ID yet) while still verifying
// real tokens once login is wired up.
const requireAuth = process.env.REQUIRE_AUTH === "true";

const strictJwt = authConfigured
  ? auth({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
    })
  : null;

const jwtCheck = !strictJwt
  ? (req, res, next) => next()
  : (req, res, next) => {
      const hasToken = Boolean(req.headers.authorization);
      if (!hasToken && !requireAuth) return next(); // demo / unauthenticated
      return strictJwt(req, res, next);
    };

export function authMiddleware() {
  return jwtCheck;
}

export async function ensureUserProfile(req, res, next) {
  try {
    const auth0UserId = req.auth?.payload?.sub;
    if (!auth0UserId) {
      // No verified user: reject only in strict mode, else continue as demo.
      return requireAuth
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

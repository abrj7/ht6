import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || null;
let client = null;
// After a connect failure, stop hammering the dead cluster: skip Mongo for a
// cooldown window so every request doesn't eat a fresh (failing) TLS handshake.
let lastFailAt = 0;
const FAIL_COOLDOWN_MS = 60 * 1000;

export async function getDb() {
  if (!MONGODB_URI) return null;
  // Recently failed and no live client — don't retry yet, degrade instantly.
  if (!client && Date.now() - lastFailAt < FAIL_COOLDOWN_MS) return null;
  try {
    if (!client) {
      // Fail fast instead of hanging the request when the cluster is
      // unreachable (bad URI, IP allowlist, offline).
      client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
      await client.connect();
    }
    return client.db();
  } catch (err) {
    // Degrade to "no Mongo" so callers fall back gracefully instead of 500ing.
    // Cache the failure so the next 60s of requests skip Mongo and stay fast.
    console.warn("Mongo unavailable, degrading to no-db (60s cooldown):", err.message);
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
    client = null;
    lastFailAt = Date.now();
    return null;
  }
}

export async function insertTransaction(tx) {
  const db = await getDb();
  if (!db) throw new Error("MONGODB_URI not configured");
  const res = await db.collection("transactions").insertOne(tx);
  return res;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
  }
}

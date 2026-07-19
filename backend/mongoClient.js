import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || null;
let client = null;

export async function getDb() {
  if (!MONGODB_URI) return null;
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client.db();
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

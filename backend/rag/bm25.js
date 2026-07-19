function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export class BM25 {
  constructor(docs, k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.docs = docs.map((d) => ({ ...d, tokens: tokenize(d.text) }));
    this.N = this.docs.length;
    this.avgdl =
      this.docs.reduce((s, d) => s + d.tokens.length, 0) / (this.N || 1) || 1;
    this.df = new Map();
    for (const doc of this.docs) {
      for (const t of new Set(doc.tokens)) {
        this.df.set(t, (this.df.get(t) || 0) + 1);
      }
    }
  }

  score(query) {
    const qTokens = tokenize(query);
    return this.docs
      .map((doc, index) => {
        let score = 0;
        const dl = doc.tokens.length;
        for (const qt of qTokens) {
          const tf = doc.tokens.filter((t) => t === qt).length;
          if (!tf) continue;
          const df = this.df.get(qt) || 0;
          const idf = Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
          const denom = tf + this.k1 * (1 - this.b + this.b * (dl / this.avgdl));
          score += (idf * (tf * (this.k1 + 1))) / denom;
        }
        return { index, score };
      })
      .sort((a, b) => b.score - a.score);
  }
}

export { tokenize };

import { translateTokens } from "./lexicon";
import { terms } from "./text";

/** Field-weighted BM25 lexical index (title/author matches dominate). */
export class BM25Index {
  private docs = new Map<string, Map<string, number>>(); // id -> term -> weighted tf
  private lens = new Map<string, number>();
  private df = new Map<string, number>();
  private avgLen = 1;
  constructor(private k1 = 1.2, private b = 0.75) {}

  add(id: string, fields: { text: string; weight: number }[]) {
    if (this.docs.has(id)) return;
    const tf = new Map<string, number>();
    let len = 0;
    for (const f of fields) {
      for (const t of translateTokens(terms(f.text))) {
        tf.set(t, (tf.get(t) ?? 0) + f.weight);
        len += f.weight;
      }
    }
    this.docs.set(id, tf);
    this.lens.set(id, len);
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    let total = 0;
    for (const l of this.lens.values()) total += l;
    this.avgLen = total / this.lens.size;
  }

  search(query: string, k = 50): { id: string; score: number }[] {
    const q = [...new Set(translateTokens(terms(query)))];
    const N = this.docs.size;
    const out: { id: string; score: number }[] = [];
    for (const [id, tf] of this.docs) {
      let s = 0;
      const len = this.lens.get(id) ?? 1;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * len) / this.avgLen)));
      }
      if (s > 0) out.push({ id, score: s });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, k);
  }
}

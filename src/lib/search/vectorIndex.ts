/**
 * VectorIndex abstraction. The MVP ships a brute-force in-memory cosine index
 * (fine up to ~100k vectors). For production swap in a Qdrant / pgvector
 * implementation of the same interface — payload filtering maps to `filter`.
 */
export interface VectorRecord<M> {
  id: string;
  vector: Float32Array;
  meta: M;
}

export interface VectorIndex<M> {
  upsert(records: VectorRecord<M>[]): Promise<void>;
  search(query: Float32Array, k: number, filter?: (m: M) => boolean): Promise<{ id: string; score: number; meta: M }[]>;
  size(): number;
  clear(): void;
}

export class InMemoryVectorIndex<M> implements VectorIndex<M> {
  private records = new Map<string, VectorRecord<M>>();

  async upsert(records: VectorRecord<M>[]) {
    for (const r of records) this.records.set(r.id, r);
  }

  async search(q: Float32Array, k: number, filter?: (m: M) => boolean) {
    const out: { id: string; score: number; meta: M }[] = [];
    for (const r of this.records.values()) {
      if (filter && !filter(r.meta)) continue;
      if (r.vector.length !== q.length) continue;
      let dot = 0;
      for (let i = 0; i < q.length; i++) dot += q[i] * r.vector[i];
      out.push({ id: r.id, score: dot, meta: r.meta });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, k);
  }

  size() {
    return this.records.size;
  }
  clear() {
    this.records.clear();
  }
}

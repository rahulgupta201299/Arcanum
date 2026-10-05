import { expandConcepts, translateTokens } from "./lexicon";
import { hash32, normalize, terms } from "./text";

/** Swappable embedding provider. All vectors are L2-normalised. */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dims: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

/**
 * Zero-dependency local embedder: signed feature hashing of
 * (translated + concept-expanded) word unigrams, bigrams and char trigrams.
 * Not a neural model, but gives robust fuzzy/semantic-ish matching offline.
 */
export class LocalHashEmbedder implements EmbeddingProvider {
  readonly name = "local-hash";
  constructor(readonly dims = 768) {}

  private vec(text: string): Float32Array {
    const v = new Float32Array(this.dims);
    const base = translateTokens(terms(text));
    const expanded = expandConcepts(base);
    const add = (feat: string, w: number) => {
      const h = hash32(feat);
      const idx = h % this.dims;
      v[idx] += (h & 0x80000000 ? -1 : 1) * w;
    };
    for (const t of base) add("w:" + t, 1);
    for (const t of expanded) for (const p of terms(t)) add("w:" + p, 0.45);
    for (let i = 0; i + 1 < base.length; i++) add("b:" + base[i] + "_" + base[i + 1], 0.6);
    const n = normalize(text).replace(/\s+/g, " ");
    for (let i = 0; i + 3 <= n.length; i++) add("c:" + n.slice(i, i + 3), 0.12);
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  }

  async embed(texts: string[]) {
    return texts.map((t) => this.vec(t));
  }
}

export class OpenAIEmbedder implements EmbeddingProvider {
  readonly name = "openai";
  readonly dims = 1536;
  constructor(private key: string, private model = "text-embedding-3-small") {}
  async embed(texts: string[]) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => Float32Array.from(d.embedding));
  }
}

export class OllamaEmbedder implements EmbeddingProvider {
  readonly name = "ollama";
  readonly dims = 768;
  constructor(private url: string, private model = "nomic-embed-text") {}
  async embed(texts: string[]) {
    const res = await fetch(`${this.url}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) throw new Error(`Ollama embeddings ${res.status}`);
    const json = (await res.json()) as { embeddings: number[][] };
    return json.embeddings.map((e) => {
      const v = Float32Array.from(e);
      const n = Math.hypot(...v) || 1;
      return v.map((x) => x / n);
    });
  }
}

/** Wraps a remote provider and falls back to local hashing on failure. */
class Resilient implements EmbeddingProvider {
  private failed = false;
  constructor(private primary: EmbeddingProvider, private fallback: EmbeddingProvider) {}
  get name() {
    return this.failed ? this.fallback.name : this.primary.name;
  }
  get dims() {
    return this.failed ? this.fallback.dims : this.primary.dims;
  }
  async embed(texts: string[]) {
    if (!this.failed) {
      try {
        return await this.primary.embed(texts);
      } catch (e) {
        console.warn("[embeddings] primary failed, switching to local:", (e as Error).message);
        this.failed = true; // keep a single vector space for the whole index
      }
    }
    return this.fallback.embed(texts);
  }
}

let singleton: EmbeddingProvider | null = null;
export function getEmbedder(): EmbeddingProvider {
  if (singleton) return singleton;
  const local = new LocalHashEmbedder();
  const p = process.env.EMBEDDING_PROVIDER ?? "local";
  if (p === "openai" && process.env.OPENAI_API_KEY)
    singleton = new Resilient(new OpenAIEmbedder(process.env.OPENAI_API_KEY, process.env.OPENAI_EMBEDDING_MODEL), local);
  else if (p === "ollama")
    singleton = new Resilient(new OllamaEmbedder(process.env.OLLAMA_URL ?? "http://localhost:11434", process.env.OLLAMA_EMBEDDING_MODEL), local);
  else singleton = local;
  return singleton;
}

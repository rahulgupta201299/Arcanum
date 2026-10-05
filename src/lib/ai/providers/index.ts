/**
 * LLM provider abstraction. Every provider takes a system prompt + messages
 * and returns text. `json: true` asks the provider for a strict JSON object.
 * Add a provider by implementing LLMProvider and registering it in getLLM().
 */
export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: LLMRequest): Promise<string>;
}

const withTimeout = async (p: (signal: AbortSignal) => Promise<Response>, ms = 15000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await p(c.signal);
  } finally {
    clearTimeout(t);
  }
};

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  constructor(private key: string, private model = "gpt-4o-mini", private baseUrl = "https://api.openai.com/v1") {}
  async complete({ system, messages, json, maxTokens = 500, temperature = 0.6 }: LLMRequest) {
    const res = await withTimeout((signal) =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({
          model: this.model,
          temperature,
          max_tokens: maxTokens,
          response_format: json ? { type: "json_object" } : undefined,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      }),
    );
    if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? "";
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  constructor(private key: string, private model = "claude-sonnet-4-5") {}
  async complete({ system, messages, json, maxTokens = 500, temperature = 0.6 }: LLMRequest) {
    const res = await withTimeout((signal) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-api-key": this.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          system: json ? `${system}\nRespond with a single JSON object only, no prose.` : system,
          messages,
        }),
      }),
    );
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.map((c) => c.text ?? "").join("");
  }
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  constructor(private key: string, private model = "gemini-2.0-flash") {}
  async complete({ system, messages, json, maxTokens = 500, temperature = 0.6 }: LLMRequest) {
    const res = await withTimeout((signal) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.key}`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: json ? "application/json" : "text/plain" },
        }),
      }),
    );
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] };
    return data.candidates?.[0]?.content.parts.map((p) => p.text).join("") ?? "";
  }
}

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  constructor(private url = "http://localhost:11434", private model = "llama3.1") {}
  async complete({ system, messages, json, temperature = 0.6 }: LLMRequest) {
    const res = await withTimeout(
      (signal) =>
        fetch(`${this.url}/api/chat`, {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.model,
            stream: false,
            format: json ? "json" : undefined,
            options: { temperature },
            messages: [{ role: "system", content: system }, ...messages],
          }),
        }),
      30000,
    );
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const data = (await res.json()) as { message: { content: string } };
    return data.message.content;
  }
}

/** Returns the configured provider, or null for the offline rule engine. */
export function getLLM(): LLMProvider | null {
  const p = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  const e = process.env;
  if ((p === "openai" || (!p && e.OPENAI_API_KEY)) && e.OPENAI_API_KEY) return new OpenAIProvider(e.OPENAI_API_KEY, e.OPENAI_MODEL);
  if ((p === "anthropic" || (!p && e.ANTHROPIC_API_KEY)) && e.ANTHROPIC_API_KEY) return new AnthropicProvider(e.ANTHROPIC_API_KEY, e.ANTHROPIC_MODEL);
  if ((p === "gemini" || (!p && e.GEMINI_API_KEY)) && e.GEMINI_API_KEY) return new GeminiProvider(e.GEMINI_API_KEY, e.GEMINI_MODEL);
  if (p === "ollama") return new OllamaProvider(e.OLLAMA_URL, e.OLLAMA_MODEL);
  return null;
}

export function parseJSON<T>(text: string): T | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  }
}

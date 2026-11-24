import "server-only";
import { env } from "@/lib/env";
import { IntegrationNotConfiguredError, ProviderError } from "./errors";

export interface EmbeddingResult {
  provider: string;
  model: string;
  vectors: number[][];
}

export function embeddingsConfigured(): boolean {
  return env.EMBEDDINGS_PROVIDER !== "none" && !!env.EMBEDDINGS_API_KEY;
}

export function embeddingModel(): string {
  return env.EMBEDDINGS_MODEL ?? (env.EMBEDDINGS_PROVIDER === "voyage" ? "voyage-3.5" : "text-embedding-3-small");
}

export async function embed(texts: string[], kind: "document" | "query"): Promise<EmbeddingResult> {
  if (!embeddingsConfigured()) throw new IntegrationNotConfiguredError("Embeddings", "EMBEDDINGS_PROVIDER and EMBEDDINGS_API_KEY are required for semantic search");
  const model = embeddingModel();
  const input = texts.map((t) => t.slice(0, 8000));
  if (env.EMBEDDINGS_PROVIDER === "openai") {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { embedding: number[] }[] };
    if (!res.ok || !body.data) throw new ProviderError("openai", `Embeddings error ${res.status}`, res.status >= 500);
    return { provider: "openai", model, vectors: body.data.map((d) => d.embedding) };
  }
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.EMBEDDINGS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input, input_type: kind }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { embedding: number[] }[] };
  if (!res.ok || !body.data) throw new ProviderError("voyage", `Embeddings error ${res.status}`, res.status >= 500);
  return { provider: "voyage", model, vectors: body.data.map((d) => d.embedding) };
}

export function embeddingsStatus() {
  if (env.EMBEDDINGS_PROVIDER === "none") return { configured: false, provider: "None — answer bank uses keyword search fallback", missing: ["EMBEDDINGS_PROVIDER", "EMBEDDINGS_API_KEY"] };
  return { configured: !!env.EMBEDDINGS_API_KEY, provider: env.EMBEDDINGS_PROVIDER === "openai" ? "OpenAI embeddings" : "Voyage AI embeddings", missing: env.EMBEDDINGS_API_KEY ? [] : ["EMBEDDINGS_API_KEY"] };
}

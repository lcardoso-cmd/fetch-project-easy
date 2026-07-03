// Tabela de preços estimados (USD por 1M tokens) para os modelos usados via
// Lovable AI Gateway. Fonte: preços públicos de referência dos providers.
// Ajuste em um único lugar — o painel de consumo reflete a mudança
// automaticamente para eventos futuros.

interface Price {
  in: number; // USD por 1M input tokens
  out: number; // USD por 1M output tokens
}

const PRICING: Record<string, Price> = {
  // Gemini
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "google/gemini-2.5-pro": { in: 1.25, out: 10.0 },
  "google/gemini-3-flash-preview": { in: 0.3, out: 2.5 },
  "google/gemini-3.1-flash-lite": { in: 0.1, out: 0.4 },
  "google/gemini-3.5-flash": { in: 0.3, out: 2.5 },
  "google/gemini-3.1-pro-preview": { in: 1.25, out: 10.0 },
  // OpenAI
  "openai/gpt-5": { in: 1.25, out: 10.0 },
  "openai/gpt-5-mini": { in: 0.25, out: 2.0 },
  "openai/gpt-5-nano": { in: 0.05, out: 0.4 },
  // Embeddings (só entrada)
  "openai/text-embedding-3-small": { in: 0.02, out: 0 },
  "openai/text-embedding-3-large": { in: 0.13, out: 0 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICING[model];
  if (!p) return 0;
  const cost =
    (promptTokens / 1_000_000) * p.in + (completionTokens / 1_000_000) * p.out;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function knownModels(): string[] {
  return Object.keys(PRICING);
}

/**
 * The only file that names a model vendor (as in sesh-ai's model-roles ADR).
 *
 * - ask: Claude Sonnet 5.5 answers from retrieved passages (no persona).
 * - embedding: OpenAI text-embedding-3-large pinned to 1536 dimensions, the
 *   same model the chunk vectors were built with.
 *
 * Keys: ANTHROPIC_API_KEY, OPENAI_API_KEY (read by the providers). Model ids
 * can be overridden with SESSIONS_MODEL_ASK / SESSIONS_MODEL_EMBEDDING.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { embed, embedMany, type LanguageModel } from 'ai';

export const DEFAULT_ASK_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-large';
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * USD per million tokens for the ask model, for the daily spend cap. Override
 * with SESSIONS_ASK_PRICE_INPUT / SESSIONS_ASK_PRICE_OUTPUT if pricing changes.
 */
export const DEFAULT_ASK_PRICE = { inputPerMTok: 3, outputPerMTok: 15 };

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function askModelId(): string {
  return env('SESSIONS_MODEL_ASK') ?? DEFAULT_ASK_MODEL;
}

export function embeddingModelId(): string {
  return env('SESSIONS_MODEL_EMBEDDING') ?? DEFAULT_EMBEDDING_MODEL;
}

export function getAskModel(): LanguageModel {
  return anthropic(askModelId());
}

/**
 * Provider options for an ask call: no thinking before the answer. Sonnet 5.5
 * refuses `{ type: 'disabled' }` and names `between_tools` as its off switch
 * (API error, 2026-10-07); with no tools in an ask call, nothing is thought.
 */
export const ASK_PROVIDER_OPTIONS = { anthropic: { thinking: { type: 'between_tools' } } };

export function askPrice(): { inputPerMTok: number; outputPerMTok: number } {
  const input = Number(env('SESSIONS_ASK_PRICE_INPUT'));
  const output = Number(env('SESSIONS_ASK_PRICE_OUTPUT'));
  return {
    inputPerMTok: Number.isFinite(input) && input > 0 ? input : DEFAULT_ASK_PRICE.inputPerMTok,
    outputPerMTok: Number.isFinite(output) && output > 0 ? output : DEFAULT_ASK_PRICE.outputPerMTok,
  };
}

export function hasAskKey(): boolean {
  return Boolean(env('ANTHROPIC_API_KEY'));
}

export function hasEmbeddingKey(): boolean {
  return Boolean(env('OPENAI_API_KEY'));
}

const embeddingOptions = { openai: { dimensions: EMBEDDING_DIMENSIONS } };

/** Embed a search query; null when no key is configured or the call fails. */
export async function embedQuery(text: string, timeoutMs = 4000): Promise<Float32Array | null> {
  if (!hasEmbeddingKey()) return null;
  try {
    const { embedding } = await embed({
      model: openai.embedding(embeddingModelId()),
      value: text,
      providerOptions: embeddingOptions,
      abortSignal: AbortSignal.timeout(timeoutMs),
      maxRetries: 0,
    });
    return Float32Array.from(embedding);
  } catch {
    return null;
  }
}

/** Embed chunk texts (the indexer). Throws on failure. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const { embeddings } = await embedMany({
      model: openai.embedding(embeddingModelId()),
      values: texts.slice(i, i + 64),
      providerOptions: embeddingOptions,
      maxRetries: 1,
    });
    out.push(...embeddings);
  }
  return out;
}

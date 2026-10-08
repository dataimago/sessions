/**
 * Corpus bundle v1 (`dataimago.corpus-bundle.v1`), as emitted by sesh-ai's
 * `pnpm corpus:bundle` (sesh-ai/docs/corpus-bundle.md). The library validates
 * every bundle against this schema when the registry is generated, and never
 * reads anything but bundles.
 */
import * as z from 'zod';

export const BUNDLE_SCHEMA = 'dataimago.corpus-bundle.v1';
export const COLLECTION_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

const Locator = z.object({
  page: z.number().int().optional(),
  lineStart: z.number().int().optional(),
  lineEnd: z.number().int().optional(),
  heading: z.string().optional(),
  slide: z.number().int().optional(),
  path: z.string().optional(),
});

export const CorpusBundleSchema = z.object({
  schema: z.literal(BUNDLE_SCHEMA),
  collection: z.string().regex(COLLECTION_RE),
  provenance: z.object({
    repository: z.string(),
    commitSha: z.string().regex(/^[0-9a-f]{40}$/),
    manifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    chunker: z.string(),
    site: z.url(),
  }),
  session: z.object({
    slug: z.string(),
    title: z.string(),
    event: z.string(),
    heldOn: z.string(),
    venue: z.string(),
    timezone: z.string(),
    participants: z.array(
      z.object({
        handle: z.string(),
        displayName: z.string(),
        affiliation: z.string(),
        role: z.string(),
        alsoPanelist: z.boolean(),
      }),
    ),
    guidingQuestions: z.array(z.object({ id: z.string(), label: z.string().optional(), text: z.string() })),
    runOfShow: z.array(
      z.object({ id: z.string(), name: z.string(), startMin: z.number(), durationMin: z.number() }),
    ),
  }),
  documents: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      title: z.string(),
      owner: z.string(),
      kind: z.string(),
      label: z.string(),
      mimeType: z.string().optional(),
      sha256: z.string(),
      wordCount: z.number().optional(),
      pageCount: z.number().optional(),
      href: z.url(),
      sourceHref: z.url(),
      chunkIds: z.array(z.string()),
    }),
  ),
  chunks: z.array(
    z.object({
      id: z.string(),
      documentId: z.string(),
      ordinal: z.number().int(),
      text: z.string(),
      locator: Locator,
      tokenCount: z.number(),
    }),
  ),
});

export type CorpusBundle = z.infer<typeof CorpusBundleSchema>;
export type BundleDocument = CorpusBundle['documents'][number];
export type BundleChunk = CorpusBundle['chunks'][number];
export type BundleParticipant = CorpusBundle['session']['participants'][number];
export type Locator = z.infer<typeof Locator>;

/** Chunk embeddings, committed beside the bundle so builds never call a model. */
export const EmbeddingsSchema = z.object({
  model: z.string(),
  dimensions: z.number().int().positive(),
  /** chunk id → base64 of little-endian float32 values. */
  vectors: z.record(z.string(), z.string()),
});
export type Embeddings = z.infer<typeof EmbeddingsSchema>;

export function decodeVector(b64: string): Float32Array {
  const bytes = Buffer.from(b64, 'base64');
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4).slice();
}

export function encodeVector(values: ArrayLike<number>): string {
  return Buffer.from(Float32Array.from(values).buffer).toString('base64');
}

/** "page 3", "lines 12–40", or "" — the human form of a locator. */
export function formatLocator(locator: Locator): string {
  if (locator.slide !== undefined) return `slide ${locator.slide}`;
  if (locator.page !== undefined) return `page ${locator.page}`;
  if (locator.lineStart !== undefined) {
    return locator.lineEnd !== undefined && locator.lineEnd !== locator.lineStart
      ? `lines ${locator.lineStart}–${locator.lineEnd}`
      : `line ${locator.lineStart}`;
  }
  return '';
}

/**
 * Validate a bundle and check it is internally consistent: unique ids, every
 * chunk's document exists, and each document's `chunkIds` is exactly its chunks.
 */
export function parseBundle(raw: unknown): CorpusBundle {
  const bundle = CorpusBundleSchema.parse(raw);
  const docIds = new Set<string>();
  for (const d of bundle.documents) {
    if (docIds.has(d.id)) throw new Error(`duplicate document id ${d.id}`);
    docIds.add(d.id);
  }
  const chunkIds = new Set<string>();
  for (const c of bundle.chunks) {
    if (chunkIds.has(c.id)) throw new Error(`duplicate chunk id ${c.id}`);
    if (!docIds.has(c.documentId)) throw new Error(`chunk ${c.id} names unknown document`);
    chunkIds.add(c.id);
  }
  for (const d of bundle.documents) {
    const own = bundle.chunks.filter((c) => c.documentId === d.id).map((c) => c.id);
    if (own.join('\n') !== d.chunkIds.join('\n')) throw new Error(`document ${d.id} chunkIds mismatch`);
  }
  return bundle;
}

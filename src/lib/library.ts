/**
 * The library: every collection the registry bundles, parsed once, with its
 * search index. A collection is `<conference>/<session>`.
 */
import { RAW_COLLECTIONS } from '@/generated/registry';

import {
  COLLECTION_RE,
  EmbeddingsSchema,
  decodeVector,
  parseBundle,
  type BundleChunk,
  type BundleDocument,
  type BundleParticipant,
  type CorpusBundle,
} from './bundle';
import { buildBm25, hybridSearch, type Bm25Index, type SearchHit } from './search';

export interface Collection {
  id: string;
  conference: string;
  session: string;
  bundle: CorpusBundle;
  documents: Map<string, BundleDocument>;
  chunks: Map<string, BundleChunk>;
  participants: Map<string, BundleParticipant>;
  bm25: Bm25Index;
  vectors: Map<string, Float32Array> | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
}

export interface Provenance {
  collection: string;
  repository: string;
  commitSha: string;
  manifestSha256: string;
  chunker: string;
  site: string;
  embeddingModel: string | null;
}

function load(raw: { bundle: unknown; embeddings: unknown }): Collection {
  const bundle = parseBundle(raw.bundle);
  const match = COLLECTION_RE.exec(bundle.collection);
  if (!match?.[1] || !match[2]) throw new Error(`bad collection ${bundle.collection}`);
  let vectors: Map<string, Float32Array> | null = null;
  let embeddingModel: string | null = null;
  let embeddingDimensions: number | null = null;
  if (raw.embeddings) {
    const emb = EmbeddingsSchema.parse(raw.embeddings);
    vectors = new Map();
    for (const c of bundle.chunks) {
      const v = emb.vectors[c.id];
      if (v) vectors.set(c.id, decodeVector(v));
    }
    embeddingModel = emb.model;
    embeddingDimensions = emb.dimensions;
  }
  return {
    id: bundle.collection,
    conference: match[1],
    session: match[2],
    bundle,
    documents: new Map(bundle.documents.map((d) => [d.id, d])),
    chunks: new Map(bundle.chunks.map((c) => [c.id, c])),
    participants: new Map(bundle.session.participants.map((p) => [p.handle, p])),
    bm25: buildBm25(bundle.chunks.map((c) => ({ id: c.id, text: c.text }))),
    vectors,
    embeddingModel,
    embeddingDimensions,
  };
}

let cache: Map<string, Collection> | null = null;

export function library(): Map<string, Collection> {
  if (!cache) cache = new Map(RAW_COLLECTIONS.map(load).map((c) => [c.id, c]));
  return cache;
}

export function listCollections(): Collection[] {
  return [...library().values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function getCollection(conference: string, session: string): Collection | undefined {
  return library().get(`${conference}/${session}`);
}

export function getCollectionById(id: string): Collection | undefined {
  return library().get(id);
}

export function conferences(): { conference: string; event: string; collections: Collection[] }[] {
  const byConf = new Map<string, Collection[]>();
  for (const c of listCollections()) byConf.set(c.conference, [...(byConf.get(c.conference) ?? []), c]);
  return [...byConf.entries()].map(([conference, collections]) => ({
    conference,
    event: collections[0]?.bundle.session.event ?? conference,
    collections,
  }));
}

export function provenance(c: Collection): Provenance {
  return {
    collection: c.id,
    ...c.bundle.provenance,
    embeddingModel: c.embeddingModel,
  };
}

export function collectionPath(c: Collection): string {
  return `/${c.conference}/${c.session}`;
}

export function passageHref(c: Collection, chunk: BundleChunk): string {
  return `${collectionPath(c)}/documents/${chunk.documentId}#${chunk.id}`;
}

export interface PassageHit extends SearchHit {
  chunk: BundleChunk;
  document: BundleDocument;
}

export function search(
  c: Collection,
  query: string,
  queryVector: Float32Array | null,
  limit: number,
): PassageHit[] {
  return hybridSearch({ bm25: c.bm25, vectors: c.vectors, query, queryVector, limit }).flatMap((hit) => {
    const chunk = c.chunks.get(hit.id);
    const document = chunk ? c.documents.get(chunk.documentId) : undefined;
    return chunk && document ? [{ ...hit, chunk, document }] : [];
  });
}

/** Documents grouped by owner (participants in spec order), then by label. */
export function documentsByOwner(c: Collection): { participant: BundleParticipant | undefined; owner: string; documents: BundleDocument[] }[] {
  const order = c.bundle.session.participants.map((p) => p.handle);
  const owners = [...new Set(c.bundle.documents.map((d) => d.owner))].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
  return owners.map((owner) => ({
    owner,
    participant: c.participants.get(owner),
    documents: c.bundle.documents.filter((d) => d.owner === owner),
  }));
}

export function roleLabel(p: BundleParticipant): string {
  if (p.role === 'chair') return p.alsoPanelist ? 'Session chair and panelist' : 'Session chair';
  if (p.role === 'discussant') return 'Discussant';
  if (p.role === 'panelist') return 'Panelist';
  return p.role;
}

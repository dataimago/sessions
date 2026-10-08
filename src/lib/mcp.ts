/**
 * The library's MCP surface: retrieval only, read-only, anonymous. There is
 * deliberately no ask tool — a calling AI reasons over cited passages itself.
 * Every result carries the collection's provenance (repository, commit,
 * manifest hash) so a citation can be checked against the pinned source.
 *
 * Tool shapes follow dataimago-design/tools/mcp/server.mjs (registerTool with
 * zod input schemas).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import { formatLocator } from './bundle';
import {
  collectionPath,
  getCollectionById,
  listCollections,
  passageHref,
  provenance,
  roleLabel,
  search,
  type Collection,
} from './library';
import { embedQuery } from './models';

export const MCP_SERVER_NAME = 'dataimago-sessions';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function failure(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

const collectionArg = z
  .string()
  .describe('Collection id, "<conference-year>/<session>", e.g. "aime-2026/ai-native-profession". See list_collections.');

export function buildMcpServer(opts: { origin: string; embed?: (q: string) => Promise<Float32Array | null> }): McpServer {
  const embed = opts.embed ?? ((q: string) => embedQuery(q));
  const url = (path: string) => `${opts.origin}${path}`;
  const server = new McpServer({ name: MCP_SERVER_NAME, version: '1.0.0' });

  const withCollection = (id: string): Collection | string => {
    const c = getCollectionById(id);
    return c ?? `Unknown collection "${id}". Call list_collections for the available ids.`;
  };

  server.registerTool(
    'list_collections',
    {
      title: 'List session collections',
      description:
        'List every session in the library: the shared, citable materials of one conference session each. Returns ids to pass to the other tools.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () =>
      result({
        collections: listCollections().map((c) => ({
          collection: c.id,
          title: c.bundle.session.title,
          event: c.bundle.session.event,
          heldOn: c.bundle.session.heldOn,
          participants: c.bundle.session.participants.map((p) => `${p.displayName} (${roleLabel(p)})`),
          documents: c.bundle.documents.length,
          passages: c.bundle.chunks.length,
          url: url(collectionPath(c)),
          provenance: provenance(c),
        })),
      }),
  );

  server.registerTool(
    'list_documents',
    {
      title: 'List documents in a session',
      description: 'List the documents in one session collection, with owner, kind and links to the published original.',
      inputSchema: { collection: collectionArg },
      annotations: READ_ONLY,
    },
    async ({ collection }) => {
      const c = withCollection(collection);
      if (typeof c === 'string') return failure(c);
      return result({
        collection: c.id,
        session: {
          title: c.bundle.session.title,
          event: c.bundle.session.event,
          heldOn: c.bundle.session.heldOn,
          participants: c.bundle.session.participants,
          guidingQuestions: c.bundle.session.guidingQuestions,
        },
        documents: c.bundle.documents.map((d) => ({
          id: d.id,
          title: d.title,
          owner: c.participants.get(d.owner)?.displayName ?? d.owner,
          ownerHandle: d.owner,
          label: d.label,
          kind: d.kind,
          passages: d.chunkIds.length,
          original: d.href,
          sourceAtCommit: d.sourceHref,
          url: url(`${collectionPath(c)}/documents/${d.id}`),
        })),
        provenance: provenance(c),
      });
    },
  );

  server.registerTool(
    'get_document',
    {
      title: 'Get a document',
      description: 'Get one document and all of its passages (text with passage ids and locators) for citation.',
      inputSchema: { collection: collectionArg, document_id: z.string().describe('Document id from list_documents.') },
      annotations: READ_ONLY,
    },
    async ({ collection, document_id }) => {
      const c = withCollection(collection);
      if (typeof c === 'string') return failure(c);
      const d = c.documents.get(document_id);
      if (!d) return failure(`Unknown document "${document_id}" in ${c.id}.`);
      return result({
        collection: c.id,
        document: {
          id: d.id,
          title: d.title,
          owner: c.participants.get(d.owner)?.displayName ?? d.owner,
          label: d.label,
          kind: d.kind,
          original: d.href,
          sourceAtCommit: d.sourceHref,
          sha256: d.sha256,
        },
        passages: d.chunkIds.flatMap((id) => {
          const ch = c.chunks.get(id);
          return ch ? [{ id: ch.id, locator: formatLocator(ch.locator), text: ch.text, url: url(passageHref(c, ch)) }] : [];
        }),
        provenance: provenance(c),
      });
    },
  );

  server.registerTool(
    'search_corpus',
    {
      title: 'Search session materials',
      description:
        'Hybrid lexical and semantic search over passages. Omit collection to search every session. Returns passages with ids, locators and links; cite passage ids.',
      inputSchema: {
        query: z.string().min(2).max(500).describe('What to look for.'),
        collection: collectionArg.optional(),
        limit: z.number().int().min(1).max(20).default(8).describe('Passages to return (1–20).'),
      },
      annotations: READ_ONLY,
    },
    async ({ query, collection, limit }) => {
      const targets = collection ? [withCollection(collection)] : listCollections();
      const first = targets[0];
      if (typeof first === 'string') return failure(first);
      const vector = await embed(query);
      const hits = (targets as Collection[])
        .flatMap((c) => search(c, query, vector, limit).map((h) => ({ c, h })))
        .sort((a, b) => b.h.score - a.h.score)
        .slice(0, limit);
      return result({
        query,
        semantic: vector !== null,
        passages: hits.map(({ c, h }) => ({
          collection: c.id,
          id: h.chunk.id,
          document: { id: h.document.id, title: h.document.title, owner: c.participants.get(h.document.owner)?.displayName ?? h.document.owner },
          locator: formatLocator(h.chunk.locator),
          via: h.via,
          text: h.chunk.text,
          url: url(passageHref(c, h.chunk)),
        })),
        provenance: [...new Set(hits.map(({ c }) => c))].map(provenance),
      });
    },
  );

  server.registerTool(
    'get_passage',
    {
      title: 'Get a passage',
      description: 'Get one passage by id with its document, locator and links, to quote or verify a citation.',
      inputSchema: { collection: collectionArg, passage_id: z.string().describe('Passage id, e.g. from search_corpus.') },
      annotations: READ_ONLY,
    },
    async ({ collection, passage_id }) => {
      const c = withCollection(collection);
      if (typeof c === 'string') return failure(c);
      const ch = c.chunks.get(passage_id);
      const d = ch ? c.documents.get(ch.documentId) : undefined;
      if (!ch || !d) return failure(`Unknown passage "${passage_id}" in ${c.id}.`);
      return result({
        collection: c.id,
        passage: { id: ch.id, locator: formatLocator(ch.locator), text: ch.text, url: url(passageHref(c, ch)) },
        document: { id: d.id, title: d.title, owner: c.participants.get(d.owner)?.displayName ?? d.owner, original: d.href, sourceAtCommit: d.sourceHref },
        provenance: provenance(c),
      });
    },
  );

  server.registerTool(
    'get_provenance',
    {
      title: 'Get provenance',
      description: 'Where a collection comes from: repository, pinned commit, manifest hash, chunker and embedding model.',
      inputSchema: { collection: collectionArg },
      annotations: READ_ONLY,
    },
    async ({ collection }) => {
      const c = withCollection(collection);
      if (typeof c === 'string') return failure(c);
      return result({ provenance: provenance(c), repositoryUrl: `https://github.com/${c.bundle.provenance.repository}/tree/${c.bundle.provenance.commitSha}` });
    },
  );

  return server;
}

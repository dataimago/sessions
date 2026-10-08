import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { buildMcpServer } from './mcp';

async function connect() {
  const server = buildMcpServer({ origin: 'https://sessions.example', embed: async () => null });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

type Structured = Record<string, unknown> & { provenance?: unknown };

describe('mcp', () => {
  it('lists exactly the read-only retrieval tools (no ask tool)', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['get_document', 'get_passage', 'get_provenance', 'list_collections', 'list_documents', 'search_corpus'],
    );
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it('searches, then fetches a cited passage, with provenance on each result', async () => {
    const client = await connect();
    const search = await client.callTool({ name: 'search_corpus', arguments: { query: 'peer review journal', limit: 3 } });
    const found = search.structuredContent as Structured & { passages: { id: string; collection: string; url: string }[] };
    expect(found.passages.length).toBeGreaterThan(0);
    expect(found.passages[0]?.url).toMatch(/^https:\/\/sessions\.example\/aime-2026\/ai-native-profession\/documents\//);
    const p = found.passages[0];
    if (!p) throw new Error('no passage');
    const got = await client.callTool({ name: 'get_passage', arguments: { collection: p.collection, passage_id: p.id } });
    const passage = got.structuredContent as Structured & { passage: { id: string }; provenance: { commitSha: string } };
    expect(passage.passage.id).toBe(p.id);
    expect(passage.provenance.commitSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('reports unknown collections and passages as tool errors', async () => {
    const client = await connect();
    const bad = await client.callTool({ name: 'list_documents', arguments: { collection: 'nope/none' } });
    expect(bad.isError).toBe(true);
    const missing = await client.callTool({ name: 'get_passage', arguments: { collection: 'aime-2026/ai-native-profession', passage_id: 'x' } });
    expect(missing.isError).toBe(true);
  });
});

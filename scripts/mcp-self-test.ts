/**
 * `pnpm mcp:self-test [url]` — connect to a running library's MCP endpoint
 * over streamable HTTP (default http://localhost:3000/api/mcp), list tools,
 * search, and fetch the top passage. Prints ids and counts, not text.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL(process.argv[2] ?? 'http://localhost:3000/api/mcp');
const client = new Client({ name: 'sessions-self-test', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(url));

const { tools } = await client.listTools();
console.log(`tools: ${tools.map((t) => t.name).sort().join(', ')}`);

const cols = (await client.callTool({ name: 'list_collections', arguments: {} })).structuredContent as {
  collections: { collection: string; documents: number; passages: number }[];
};
for (const c of cols.collections) console.log(`collection ${c.collection}: ${c.documents} documents, ${c.passages} passages`);

const search = (await client.callTool({ name: 'search_corpus', arguments: { query: 'peer review with AI', limit: 3 } }))
  .structuredContent as { semantic: boolean; passages: { id: string; collection: string; via: string[] }[] };
console.log(`search: ${search.passages.length} passages, semantic=${search.semantic}: ${search.passages.map((p) => `${p.id} [${p.via.join('+')}]`).join(', ')}`);

const top = search.passages[0];
if (top) {
  const got = (await client.callTool({ name: 'get_passage', arguments: { collection: top.collection, passage_id: top.id } }))
    .structuredContent as { passage: { id: string }; provenance: { commitSha: string } };
  console.log(`get_passage: ${got.passage.id} @ ${got.provenance.commitSha.slice(0, 12)}`);
}
await client.close();

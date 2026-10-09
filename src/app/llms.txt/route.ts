import { ENDPOINTS } from '@/lib/endpoints';
import { collectionPath, listCollections, roleLabel } from '@/lib/library';
import { siteOrigin } from '@/lib/site';

export function GET(request: Request) {
  const origin = siteOrigin(request);
  const lines = [
    '# dataimago session library',
    '',
    '> The shared, citable materials of conference sessions: statements, slides, briefs, bios, and the chair\'s notes, one collection per session. Read-only. Each collection is pinned to a commit of the public repository its participants chose to share.',
    '',
    'Collections hold materials prepared before each session, not a transcript of the session. Cite passage ids; every response carries the source repository, commit, manifest hash and session-spec hash.',
    '',
    '## MCP',
    '',
    `- Endpoint: ${origin}/api/mcp (streamable HTTP, stateless, anonymous, read-only)`,
    '- Tools: list_collections, list_documents, get_document, search_corpus, get_passage, get_provenance',
    `- Claude Code: claude mcp add --transport http sessions ${origin}/api/mcp`,
    '',
    '## Collections',
    '',
    ...listCollections().flatMap((c) => [
      `- [${c.bundle.session.title}](${origin}${collectionPath(c)}): ${c.bundle.session.event}, ${c.bundle.session.heldOn}; id \`${c.id}\`; ${c.bundle.documents.length} documents. ${c.bundle.session.participants.map((p) => `${p.displayName} (${roleLabel(p)})`).join('; ')}.`,
    ]),
    '',
    '## REST',
    '',
    ...ENDPOINTS.filter((e) => e.path !== '/api/mcp').map((e) => `- ${e.method} ${origin}${e.path}: ${e.summary}`),
    `- OpenAPI: ${origin}/api/openapi.json`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

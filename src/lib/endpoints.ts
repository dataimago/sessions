/** The public surface, listed once for /api/discover, /api/openapi.json and /llms.txt. */
export const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/collections', summary: 'Every session collection in the library' },
  { method: 'GET', path: '/api/v1/collections/{conference}/{session}', summary: 'One session: title, participants, guiding questions, run of show' },
  { method: 'GET', path: '/api/v1/collections/{conference}/{session}/documents', summary: 'Documents with owner, label and links to the originals' },
  { method: 'GET', path: '/api/v1/collections/{conference}/{session}/documents/{documentId}', summary: 'One document with all its passages' },
  { method: 'GET', path: '/api/v1/collections/{conference}/{session}/passages/{passageId}', summary: 'One passage, for quoting or checking a citation' },
  { method: 'GET', path: '/api/v1/collections/{conference}/{session}/search?q=&limit=', summary: 'Hybrid lexical and semantic passage search' },
  { method: 'POST', path: '/api/v1/collections/{conference}/{session}/ask', summary: 'A cited answer or an abstention ({ "question": "..." }); rate-limited, daily budget' },
  { method: 'POST', path: '/api/mcp', summary: 'MCP (streamable HTTP, stateless, read-only): list_collections, list_documents, get_document, search_corpus, get_passage, get_provenance' },
] as const;

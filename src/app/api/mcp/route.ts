/**
 * MCP over streamable HTTP, stateless: one server and one transport per
 * request (the SDK's web-standard transport cannot be reused across requests
 * without sessions). JSON responses, no SSE. Read-only tools; see lib/mcp.ts.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { clientIp, corsPreflight } from '@/lib/api';
import { counterStore, hitOrAllow } from '@/lib/limits';
import { buildMcpServer } from '@/lib/mcp';
import { siteOrigin } from '@/lib/site';

export const maxDuration = 30;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
};

export function OPTIONS() {
  return corsPreflight();
}

async function serve(request: Request): Promise<Response> {
  if (!(await hitOrAllow(counterStore(), 'mcp', clientIp(request), 120, 60))) {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32000, message: 'Rate limited; try again in a minute.' }, id: null },
      { status: 429, headers: { ...CORS, 'retry-after': '60' } },
    );
  }
  const server = buildMcpServer({ origin: siteOrigin(request) });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  } finally {
    // JSON mode has fully produced the body by now.
    await server.close();
  }
}

export const POST = serve;
export const GET = serve;
export const DELETE = serve;

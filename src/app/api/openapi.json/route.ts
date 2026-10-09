import { ENDPOINTS } from '@/lib/endpoints';
import { siteOrigin } from '@/lib/site';

export function GET(request: Request) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    if (e.path === '/api/mcp') continue;
    const [path, query] = e.path.split('?');
    const params = [...(path ?? '').matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    if (query) {
      params.push({ name: 'q', in: 'query', required: true, schema: { type: 'string' } });
      params.push({ name: 'limit', in: 'query', required: false, schema: { type: 'string' } });
    }
    paths[path ?? e.path] = {
      [e.method.toLowerCase()]: {
        summary: e.summary,
        parameters: params,
        ...(e.method === 'POST'
          ? { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['question'], properties: { question: { type: 'string', minLength: 3, maxLength: 600 } } } } } } }
          : {}),
        responses: { '200': { description: 'ok' }, '404': { description: 'not found' }, '429': { description: 'rate limited' } },
      },
    };
  }
  return Response.json(
    {
      openapi: '3.1.0',
      info: { title: 'dataimago session library', version: '1.0.0', description: 'Read-only access to the shared materials of conference sessions.' },
      servers: [{ url: siteOrigin(request) }],
      paths,
    },
    { headers: { 'access-control-allow-origin': '*' } },
  );
}

import { corsPreflight, handle, ok } from '@/lib/api';
import { ENDPOINTS } from '@/lib/endpoints';
import { listCollections } from '@/lib/library';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  return handle(request, 'discover', async (ctx) =>
    ok(ctx, {
      name: 'dataimago session library',
      collections: listCollections().map((c) => c.id),
      endpoints: ENDPOINTS,
      mcp: { transport: 'streamable-http', path: '/api/mcp', readOnly: true },
    }),
  );
}

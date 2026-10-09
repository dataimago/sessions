import { corsPreflight, handle, ok } from '@/lib/api';
import { collectionFrom, type SessionParams } from '@/lib/route-params';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request, { params }: SessionParams) {
  return handle(request, 'documents.list', async (ctx) => {
    const c = await collectionFrom(params);
    return ok(
      ctx,
      c.bundle.documents.map(({ chunkIds, ...d }) => ({ ...d, passages: chunkIds.length })),
      c,
    );
  });
}

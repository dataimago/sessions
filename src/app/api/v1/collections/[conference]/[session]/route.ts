import { corsPreflight, handle, ok } from '@/lib/api';
import { collectionFrom, type SessionParams } from '@/lib/route-params';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request, { params }: SessionParams) {
  return handle(request, 'collections.get', async (ctx) => {
    const c = await collectionFrom(params);
    return ok(ctx, { collection: c.id, session: c.bundle.session, documents: c.bundle.documents.length, passages: c.bundle.chunks.length }, c);
  });
}

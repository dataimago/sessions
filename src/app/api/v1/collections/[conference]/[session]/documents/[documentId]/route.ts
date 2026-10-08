import { ApiError, corsPreflight, handle, ok } from '@/lib/api';
import { collectionFrom } from '@/lib/route-params';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conference: string; session: string; documentId: string }> },
) {
  return handle(request, 'documents.get', async (ctx) => {
    const c = await collectionFrom(params);
    const { documentId } = await params;
    const d = c.documents.get(documentId);
    if (!d) throw new ApiError('NOT_FOUND', 'No such document.');
    const passages = d.chunkIds.flatMap((id) => {
      const ch = c.chunks.get(id);
      return ch ? [ch] : [];
    });
    return ok(ctx, { document: d, passages }, c);
  });
}

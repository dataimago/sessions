import { ApiError, corsPreflight, handle, ok } from '@/lib/api';
import { collectionFrom } from '@/lib/route-params';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conference: string; session: string; passageId: string }> },
) {
  return handle(request, 'passages.get', async (ctx) => {
    const c = await collectionFrom(params);
    const { passageId } = await params;
    const passage = c.chunks.get(passageId);
    const document = passage ? c.documents.get(passage.documentId) : undefined;
    if (!passage || !document) throw new ApiError('NOT_FOUND', 'No such passage.');
    return ok(ctx, { passage, document: { ...document, chunkIds: undefined } }, c);
  });
}

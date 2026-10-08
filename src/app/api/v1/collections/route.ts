import { corsPreflight, handle, ok } from '@/lib/api';
import { collectionPath, listCollections, provenance } from '@/lib/library';
import { siteOrigin } from '@/lib/site';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  return handle(request, 'collections.list', async (ctx) =>
    ok(
      ctx,
      listCollections().map((c) => ({
        collection: c.id,
        title: c.bundle.session.title,
        event: c.bundle.session.event,
        heldOn: c.bundle.session.heldOn,
        documents: c.bundle.documents.length,
        passages: c.bundle.chunks.length,
        url: `${siteOrigin(request)}${collectionPath(c)}`,
        provenance: provenance(c),
      })),
    ),
  );
}

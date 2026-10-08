import { ApiError, corsPreflight, handle, intParam, ok } from '@/lib/api';
import { formatLocator } from '@/lib/bundle';
import { passageHref, search } from '@/lib/library';
import { embedQuery } from '@/lib/models';
import { collectionFrom, type SessionParams } from '@/lib/route-params';
import { siteOrigin } from '@/lib/site';

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request, { params }: SessionParams) {
  return handle(request, 'search', async (ctx) => {
    const c = await collectionFrom(params);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2 || q.length > 500) throw new ApiError('MISSING_REQUIRED_PARAM', 'q must be 2–500 characters.');
    const limit = intParam(url.searchParams.get('limit'), 8, 1, 20);
    const vector = await embedQuery(q);
    const hits = search(c, q, vector, limit);
    return ok(
      ctx,
      {
        query: q,
        semantic: vector !== null,
        passages: hits.map((h) => ({
          id: h.chunk.id,
          score: h.score,
          via: h.via,
          document: { id: h.document.id, title: h.document.title, owner: h.document.owner, label: h.document.label },
          locator: formatLocator(h.chunk.locator),
          text: h.chunk.text,
          url: `${siteOrigin(request)}${passageHref(c, h.chunk)}`,
        })),
      },
      c,
    );
  });
}

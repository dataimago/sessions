import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { SessionNav } from '@/components/session-nav';
import { READ_LIMIT_PER_MINUTE, clientIp } from '@/lib/api';
import { formatLocator } from '@/lib/bundle';
import { collectionPath, passageHref, search } from '@/lib/library';
import { counterStore, hitOrAllow } from '@/lib/limits';
import { embedQuery } from '@/lib/models';
import { collectionOr404, type SessionPageProps } from '@/lib/page-params';

export const metadata: Metadata = { title: 'Search' };

type Props = SessionPageProps & { searchParams: Promise<{ q?: string | string[] }> };

function excerpt(text: string, max = 420): string {
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')} …` : text;
}

export default async function SearchPage({ params, searchParams }: Props) {
  const c = await collectionOr404(params);
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 500) ?? '';
  // The same per-IP read budget as the REST search: each query embeds once.
  const allowed =
    q.length >= 2 && (await hitOrAllow(counterStore(), 'read', clientIp({ headers: await headers() }), READ_LIMIT_PER_MINUTE, 60));
  const hits = allowed ? search(c, q, await embedQuery(q), 12) : [];
  return (
    <div className="page space-y-6">
      <SessionNav c={c} current="search" />
      <h1 className="text-2xl font-semibold">Search the materials</h1>
      <form action={`${collectionPath(c)}/search`} className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="e.g. peer review confidentiality" />
        <button className="btn" type="submit">Search</button>
      </form>
      {q.length >= 2 ? (
        <section aria-live="polite" className="space-y-4">
          {allowed ? (
            <p className="text-sm text-stone-600">{hits.length} passage{hits.length === 1 ? '' : 's'}</p>
          ) : (
            <p className="text-sm text-stone-600">Too many searches from this address. Try again in a minute.</p>
          )}
          {hits.map((h) => (
            <article key={h.chunk.id} className="card space-y-2">
              <p className="text-sm">
                <Link href={passageHref(c, h.chunk)} className="font-semibold">{h.document.title}</Link>
                <span className="text-stone-500"> · {c.participants.get(h.document.owner)?.displayName ?? h.document.owner}{formatLocator(h.chunk.locator) ? ` · ${formatLocator(h.chunk.locator)}` : ''}</span>
              </p>
              <p className="passage">{excerpt(h.chunk.text)}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

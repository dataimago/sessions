import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SessionNav } from '@/components/session-nav';
import { formatLocator } from '@/lib/bundle';
import { getCollection, listCollections } from '@/lib/library';

export const dynamicParams = false;

export function generateStaticParams() {
  return listCollections().flatMap((c) =>
    c.bundle.documents.map((d) => ({ conference: c.conference, session: c.session, documentId: d.id })),
  );
}

type Props = { params: Promise<{ conference: string; session: string; documentId: string }> };

async function load(params: Props['params']) {
  const { conference, session, documentId } = await params;
  const c = getCollection(conference, session);
  const d = c?.documents.get(documentId);
  if (!c || !d) notFound();
  return { c, d };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { d } = await load(params);
  return { title: d.title };
}

export default async function DocumentPage({ params }: Props) {
  const { c, d } = await load(params);
  const owner = c.participants.get(d.owner)?.displayName ?? d.owner;
  return (
    <div className="page space-y-8">
      <SessionNav c={c} current="document" />
      <header className="space-y-2">
        <p className="eyebrow">{d.label} · {owner}</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{d.title}</h1>
        <p className="text-sm text-stone-600">
          <a href={d.href}>Open the original</a> · <a href={d.sourceHref}>source at the pinned commit</a> ·{' '}
          {d.chunkIds.length} passage{d.chunkIds.length === 1 ? '' : 's'}
        </p>
      </header>
      <ol className="space-y-6">
        {d.chunkIds.map((id) => {
          const ch = c.chunks.get(id);
          if (!ch) return null;
          const where = formatLocator(ch.locator);
          return (
            <li key={id} id={id} className="card scroll-mt-6 target:border-stone-900 target:ring-1 target:ring-stone-900">
              <p className="mb-2 flex flex-wrap gap-x-3 text-xs text-stone-500">
                <a href={`#${id}`} className="font-mono no-underline">{id}</a>
                {where ? <span>{where}</span> : null}
              </p>
              <div className="passage">{ch.text}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { collectionPath, conferences } from '@/lib/library';

export const dynamicParams = false;

export function generateStaticParams() {
  return conferences().map(({ conference }) => ({ conference }));
}

type Props = { params: Promise<{ conference: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { conference } = await params;
  return { title: conferences().find((c) => c.conference === conference)?.event ?? conference };
}

export default async function ConferencePage({ params }: Props) {
  const { conference } = await params;
  const conf = conferences().find((c) => c.conference === conference);
  if (!conf) notFound();
  return (
    <div className="page space-y-6">
      <p className="eyebrow"><Link href="/">Library</Link></p>
      <h1 className="text-3xl font-semibold">{conf.event}</h1>
      <ul className="space-y-3">
        {conf.collections.map((c) => (
          <li key={c.id} className="card">
            <Link href={collectionPath(c)} className="font-display text-lg font-semibold">{c.bundle.session.title}</Link>
            <p className="mt-1 text-sm text-stone-600">{c.bundle.session.heldOn} · {c.bundle.documents.length} documents</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

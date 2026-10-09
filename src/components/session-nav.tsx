import Link from 'next/link';

import { collectionPath, type Collection } from '@/lib/library';

export function SessionNav({ c, current }: { c: Collection; current?: 'search' | 'ask' | 'document' }) {
  const base = collectionPath(c);
  return (
    <nav aria-label="Session" className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
      <Link href="/" className="text-stone-500">Library</Link>
      <span aria-hidden className="text-stone-300">/</span>
      <Link href={`/${c.conference}`} className="text-stone-500">{c.bundle.session.event}</Link>
      <span aria-hidden className="text-stone-300">/</span>
      <Link href={base} className="font-semibold">{c.bundle.session.title}</Link>
      <span className="ml-auto flex gap-3">
        <Link href={`${base}/search`} aria-current={current === 'search' ? 'page' : undefined}>Search</Link>
        <Link href={`${base}/ask`} aria-current={current === 'ask' ? 'page' : undefined}>Ask</Link>
      </span>
    </nav>
  );
}

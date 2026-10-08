import Link from 'next/link';

import { collectionPath, conferences, roleLabel } from '@/lib/library';

export default function LibraryHome() {
  return (
    <div className="page space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">Session library</h1>
        <p className="text-lg text-stone-700">
          Each entry holds the materials the participants of one conference session chose to share: statements, slides, briefs,
          bios and the chair&apos;s notes. Read them, search them, ask questions with cited answers, or connect an AI agent.
        </p>
      </section>
      {conferences().map(({ conference, event, collections }) => (
        <section key={conference} className="space-y-3">
          <h2 className="text-xl font-semibold">
            <Link href={`/${conference}`} className="no-underline hover:underline">{event}</Link>
          </h2>
          <ul className="space-y-3">
            {collections.map((c) => (
              <li key={c.id} className="card">
                <p className="eyebrow">{c.bundle.session.heldOn}</p>
                <Link href={collectionPath(c)} className="font-display text-lg font-semibold">{c.bundle.session.title}</Link>
                <p className="mt-1 text-sm text-stone-600">
                  {c.bundle.session.participants.map((p) => `${p.displayName} (${roleLabel(p).toLowerCase()})`).join(' · ')}
                </p>
                <p className="mt-1 text-sm text-stone-500">{c.bundle.documents.length} documents</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

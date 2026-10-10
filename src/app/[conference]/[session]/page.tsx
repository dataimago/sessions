import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionNav } from '@/components/session-nav';
import { collectionPath, documentsByOwner, roleLabel } from '@/lib/library';
import { collectionOr404, sessionStaticParams, type SessionPageProps } from '@/lib/page-params';

export const dynamicParams = false;
export const generateStaticParams = sessionStaticParams;

export async function generateMetadata({ params }: SessionPageProps): Promise<Metadata> {
  const c = await collectionOr404(params);
  return { title: c.bundle.session.title, description: `${c.bundle.session.event}, ${c.bundle.session.heldOn}: shared session materials.` };
}

export default async function SessionPage({ params }: SessionPageProps) {
  const c = await collectionOr404(params);
  const s = c.bundle.session;
  const base = collectionPath(c);
  const p = c.bundle.provenance;
  return (
    <div className="page space-y-10">
      <SessionNav c={c} />
      <header className="space-y-2">
        <p className="eyebrow">{s.event} · {s.heldOn} · {s.venue}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{s.title}</h1>
        <p className="text-stone-700">
          The materials the participants shared for this session, prepared before it took place. There is no transcript of the
          session here.
        </p>
        <form action={`${base}/search`} className="flex gap-2 pt-2" role="search">
          <label htmlFor="q" className="sr-only">Search the materials</label>
          <input id="q" name="q" className="input" placeholder="Search the materials" />
          <button className="btn" type="submit">Search</button>
        </form>
        <p className="text-sm">
          Or <Link href={`${base}/ask`}>ask a question</Link> and get an answer that cites the passages it rests on.
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="panel">
        <h2 id="panel" className="text-xl font-semibold">Panel</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {s.participants.map((person) => (
            <li key={person.handle} className="card py-3">
              <p className="font-semibold">{person.displayName}</p>
              <p className="text-sm text-stone-600">{roleLabel(person)} · {person.affiliation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="questions">
        <h2 id="questions" className="text-xl font-semibold">Guiding questions</h2>
        <ol className="list-decimal space-y-2 pl-5">
          {s.guidingQuestions.map((q) => (
            <li key={q.id}>
              {q.label ? <span className="font-semibold">{q.label}. </span> : null}
              <span className="text-stone-700">{q.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-5" aria-labelledby="documents">
        <h2 id="documents" className="text-xl font-semibold">Documents</h2>
        {documentsByOwner(c).map(({ owner, participant, documents }) => (
          <div key={owner} className="space-y-2">
            <h3 className="text-base font-semibold">{participant?.displayName ?? owner}</h3>
            <ul className="space-y-1">
              {documents.map((d) => (
                <li key={d.id} className="flex items-baseline gap-2">
                  {/* The kind stays beside its title; a long title wraps in its own column. */}
                  <span className="chip shrink-0">{d.label}</span>
                  <Link className="min-w-0" href={`${base}/documents/${d.id}`}>
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="card space-y-2 text-sm" aria-labelledby="agents">
        <h2 id="agents" className="text-base font-semibold">For AI agents</h2>
        <p>
          Connect over MCP (read-only): <code className="font-mono text-xs">/api/mcp</code>, collection id{' '}
          <code className="font-mono text-xs">{c.id}</code>. Tools: list_collections, list_documents, get_document, search_corpus,
          get_passage, get_provenance. See <a href="/llms.txt">llms.txt</a>.
        </p>
        <p className="text-stone-600">
          Source: <a href={`https://github.com/${p.repository}/tree/${p.commitSha}`}>{p.repository}</a> at{' '}
          <code className="font-mono text-xs">{p.commitSha.slice(0, 12)}</code>, published at <a href={p.site}>{p.site}</a>.
        </p>
      </section>
    </div>
  );
}

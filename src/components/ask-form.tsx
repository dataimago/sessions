'use client';

import { useState } from 'react';

type Passage = { id: string; documentId: string; documentTitle: string; owner: string; locator: string };
type Segment = { text: string; basis: 'retrieved' | 'inferred'; citations: string[]; relabeled?: boolean };
type Answer = {
  status: 'answered' | 'abstained';
  segments: Segment[];
  abstention: { reason: string; askInstead: { handle: string; displayName: string; role: string }[] } | null;
  passages: Passage[];
};

const MAX = 600;

export function AskForm({ endpoint, documentBase }: { endpoint: string; documentBase: string }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || question.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const body = (await res.json()) as { status: string; data?: Answer; message?: string };
      if (!res.ok || body.status !== 'ok' || !body.data) setError(body.message ?? 'Something went wrong.');
      else setAnswer(body.data);
    } catch {
      setError('The request failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const number = new Map(answer?.passages.map((p, i) => [p.id, i + 1]) ?? []);
  const href = (p: Passage) => `${documentBase}/${p.documentId}#${p.id}`;

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="question" className="block text-sm font-semibold">Your question</label>
        <textarea
          id="question"
          className="input min-h-28"
          maxLength={MAX}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What does Derek Briggs propose for peer review, and why?"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-500">{question.length}/{MAX}</span>
          <button className="btn" type="submit" disabled={busy || question.trim().length < 3}>
            {busy ? 'Reading the materials…' : 'Ask'}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="space-y-4">
        {error ? <p className="card border-amber-300 bg-amber-50 text-sm">{error}</p> : null}

        {answer?.status === 'abstained' && answer.abstention ? (
          <section className="card space-y-2">
            <h2 className="text-base font-semibold">The materials do not answer this</h2>
            <p>{answer.abstention.reason}</p>
            {answer.abstention.askInstead.length > 0 ? (
              <p className="text-sm text-stone-700">
                Ask instead: {answer.abstention.askInstead.map((p) => `${p.displayName} (${p.role.toLowerCase()})`).join('; ')}.
              </p>
            ) : null}
          </section>
        ) : null}

        {answer?.status === 'answered' ? (
          <section className="card space-y-3">
            <h2 className="sr-only">Answer</h2>
            {answer.segments.map((s, i) => (
              <p key={i}>
                <span className={`chip mr-2 ${s.basis === 'inferred' ? 'border-dashed' : ''}`}>
                  {s.basis === 'retrieved' ? 'in the materials' : 'interpretation'}
                </span>
                {s.text}{' '}
                {s.citations.map((id) => {
                  const p = answer.passages.find((x) => x.id === id);
                  return p ? (
                    <a key={id} href={href(p)} className="text-sm" title={`${p.documentTitle}${p.locator ? `, ${p.locator}` : ''}`}>
                      [{number.get(id)}]
                    </a>
                  ) : null;
                })}
                {s.relabeled ? <span className="ml-1 text-xs text-stone-500">(no valid citation; shown as interpretation)</span> : null}
              </p>
            ))}
          </section>
        ) : null}

        {answer && answer.passages.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Passages retrieved</h2>
            <ol className="space-y-1 text-sm">
              {answer.passages.map((p, i) => (
                <li key={p.id}>
                  [{i + 1}] <a href={href(p)}>{p.documentTitle}</a>
                  <span className="text-stone-500"> · {p.owner}{p.locator ? ` · ${p.locator}` : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}

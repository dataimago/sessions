import type { Metadata } from 'next';

import { AskForm } from '@/components/ask-form';
import { SessionNav } from '@/components/session-nav';
import { collectionPath } from '@/lib/library';
import { collectionOr404, sessionStaticParams, type SessionPageProps } from '@/lib/page-params';

export const dynamicParams = false;
export const generateStaticParams = sessionStaticParams;
export const metadata: Metadata = { title: 'Ask' };

export default async function AskPage({ params }: SessionPageProps) {
  const c = await collectionOr404(params);
  const base = collectionPath(c);
  return (
    <div className="page space-y-6">
      <SessionNav c={c} current="ask" />
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Ask the materials</h1>
        <p className="text-stone-700">
          A language model (Claude) answers from passages it retrieves from this session&apos;s shared materials, and cites them. Each
          statement is marked as stated in the materials or as an interpretation across them. When the materials do not answer
          a question, it says so and names who would know.
        </p>
        <p className="text-sm text-stone-600">
          This is a reference tool. It is not lain, the AI interlocutor that took part in the session, and it has no record of
          what was said there. Check the cited passages before relying on an answer. Questions are not stored.
        </p>
      </header>
      <AskForm endpoint={`/api/v1/collections/${c.id}/ask`} documentBase={`${base}/documents`} />
    </div>
  );
}

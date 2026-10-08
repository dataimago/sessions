import { notFound } from 'next/navigation';

import { getCollection, listCollections, type Collection } from './library';

export type SessionPageProps = { params: Promise<{ conference: string; session: string }> };

export function sessionStaticParams() {
  return listCollections().map((c) => ({ conference: c.conference, session: c.session }));
}

export async function collectionOr404(params: Promise<{ conference: string; session: string }>): Promise<Collection> {
  const { conference, session } = await params;
  const c = getCollection(conference, session);
  if (!c) notFound();
  return c;
}

import { ApiError } from './api';
import { getCollection, type Collection } from './library';

export type SessionParams = { params: Promise<{ conference: string; session: string }> };

export async function collectionFrom(params: Promise<{ conference: string; session: string }>): Promise<Collection> {
  const { conference, session } = await params;
  const c = getCollection(conference, session);
  if (!c) throw new ApiError('NOT_FOUND', 'No such collection.');
  return c;
}

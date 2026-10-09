import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeVector, encodeVector, formatLocator, parseBundle } from './bundle';
import { documentsByOwner, getCollectionById, listCollections, search } from './library';
import { embeddingModelId } from './models';

describe('library', () => {
  it('bundles the first collection with every chunk embedded', () => {
    const c = getCollectionById('aime-2026/ai-native-profession');
    expect(c?.bundle.documents.length).toBe(23);
    expect(c?.vectors?.size).toBe(c?.bundle.chunks.length);
    expect(c?.embeddingModel).toBe(embeddingModelId());
    expect(c?.bundle.session.participants.map((p) => p.handle)).not.toContain('operator');
  });

  it('groups documents by participant in panel order', () => {
    const c = listCollections()[0];
    if (!c) throw new Error('no collection');
    expect(documentsByOwner(c).map((g) => g.owner)).toEqual(['betebenner', 'briggs', 'rijmen', 'abulela']);
  });

  it('finds the peer-review statement lexically', () => {
    const c = listCollections()[0];
    if (!c) throw new Error('no collection');
    const top = search(c, 'peer review journal AI twice', null, 3).map((h) => h.document.owner);
    expect(top).toContain('briggs');
  });

  it('rejects an inconsistent bundle', () => {
    const raw = JSON.parse(readFileSync(new URL('../../content/aime-2026/ai-native-profession/bundle.json', import.meta.url), 'utf8'));
    raw.documents[0].chunkIds = raw.documents[0].chunkIds.slice(1);
    expect(() => parseBundle(raw)).toThrow(/chunkIds mismatch/);
  });

  it('round-trips vectors and formats locators', () => {
    expect([...decodeVector(encodeVector([0.5, -1, 2]))]).toEqual([0.5, -1, 2]);
    expect(formatLocator({ page: 3 })).toBe('page 3');
    expect(formatLocator({ lineStart: 4, lineEnd: 9 })).toBe('lines 4–9');
    expect(formatLocator({})).toBe('');
  });
});

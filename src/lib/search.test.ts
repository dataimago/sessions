import { describe, expect, it } from 'vitest';

import { bm25Scores, buildBm25, cosine, hybridSearch, ranked, reciprocalRankFusion, tokenize } from './search';

describe('search', () => {
  const index = buildBm25([
    { id: 'a', text: 'Peer review should use AI twice, for the reviewer and the editor.' },
    { id: 'b', text: 'Graduate programs and AI preparation in measurement training.' },
    { id: 'c', text: 'The psychometrician as guardian, catcher and architect.' },
  ]);

  it('tokenizes without stopwords or accents', () => {
    expect(tokenize('The Psychométrician, and AI!')).toEqual(['psychometrician', 'ai']);
  });

  it('ranks the lexical match first', () => {
    expect(ranked(bm25Scores(index, 'peer review'))).toEqual(['a']);
    expect(ranked(bm25Scores(index, 'graduate training'))[0]).toBe('b');
  });

  it('fuses lexical and semantic rankings and reports the signals', () => {
    const vectors = new Map([
      ['a', Float32Array.from([1, 0])],
      ['b', Float32Array.from([0, 1])],
      ['c', Float32Array.from([0.9, 0.1])],
    ]);
    const hits = hybridSearch({ bm25: index, vectors, query: 'peer review', queryVector: Float32Array.from([1, 0]), limit: 3 });
    expect(hits[0]).toMatchObject({ id: 'a', via: ['lexical', 'semantic'] });
    expect(hits.map((h) => h.id)).toContain('c');
  });

  it('works lexically when no query vector is available', () => {
    const hits = hybridSearch({ bm25: index, vectors: null, query: 'architect', queryVector: null, limit: 5 });
    expect(hits).toEqual([expect.objectContaining({ id: 'c', via: ['lexical'] })]);
  });

  it('computes cosine and RRF', () => {
    expect(cosine(Float32Array.from([1, 0]), Float32Array.from([1, 0]))).toBeCloseTo(1);
    expect(cosine(Float32Array.from([0, 0]), Float32Array.from([1, 0]))).toBe(0);
    const fused = reciprocalRankFusion([['x', 'y'], ['y']]);
    expect(ranked(fused)).toEqual(['y', 'x']);
  });
});

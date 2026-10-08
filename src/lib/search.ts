/**
 * Hybrid retrieval over one collection: BM25 over chunk text, cosine over
 * committed chunk embeddings, fused by reciprocal rank (k = 60). Pure: the
 * query vector is passed in, so search works (lexically) with no model key.
 */

const STOPWORDS = new Set(
  'a an and are as at be but by can do does for from has have how i if in into is it its of on or our so that the their them then there these they this to was we were what when where which who why will with would you your'.split(
    ' ',
  ),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export interface Bm25Index {
  docs: { id: string; tf: Map<string, number>; length: number }[];
  df: Map<string, number>;
  avgLength: number;
}

export function buildBm25(items: { id: string; text: string }[]): Bm25Index {
  const df = new Map<string, number>();
  const docs = items.map(({ id, text }) => {
    const tokens = tokenize(text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return { id, tf, length: tokens.length };
  });
  const avgLength = docs.reduce((s, d) => s + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgLength };
}

export function bm25Scores(index: Bm25Index, query: string, k1 = 1.2, b = 0.75): Map<string, number> {
  const terms = [...new Set(tokenize(query))];
  const n = index.docs.length;
  const scores = new Map<string, number>();
  for (const doc of index.docs) {
    let score = 0;
    for (const term of terms) {
      const f = doc.tf.get(term);
      if (!f) continue;
      const df = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / index.avgLength));
    }
    if (score > 0) scores.set(doc.id, score);
  }
  return scores;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Ids ordered by score, highest first; ties broken by id for determinism. */
export function ranked(scores: Map<string, number>): string[] {
  return [...scores.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    .map(([id]) => id);
}

export function reciprocalRankFusion(lists: string[][], k = 60): Map<string, number> {
  const fused = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => fused.set(id, (fused.get(id) ?? 0) + 1 / (k + rank + 1)));
  }
  return fused;
}

export interface SearchHit {
  id: string;
  score: number;
  /** Which signals found it. */
  via: ('lexical' | 'semantic')[];
}

export function hybridSearch(opts: {
  bm25: Bm25Index;
  vectors: Map<string, Float32Array> | null;
  query: string;
  queryVector: Float32Array | null;
  limit: number;
  /** How deep each signal looks before fusion. */
  depth?: number;
  /** Minimum cosine for a semantic match to count. */
  minCosine?: number;
}): SearchHit[] {
  const depth = opts.depth ?? 30;
  const lexical = ranked(bm25Scores(opts.bm25, opts.query)).slice(0, depth);
  let semantic: string[] = [];
  if (opts.vectors && opts.queryVector) {
    const sims = new Map<string, number>();
    for (const [id, v] of opts.vectors) {
      const s = cosine(opts.queryVector, v);
      if (s >= (opts.minCosine ?? 0.2)) sims.set(id, s);
    }
    semantic = ranked(sims).slice(0, depth);
  }
  const fused = reciprocalRankFusion([lexical, semantic].filter((l) => l.length > 0));
  const lexSet = new Set(lexical);
  const semSet = new Set(semantic);
  return ranked(fused)
    .slice(0, opts.limit)
    .map((id) => ({
      id,
      score: fused.get(id) ?? 0,
      via: [
        ...(lexSet.has(id) ? (['lexical'] as const) : []),
        ...(semSet.has(id) ? (['semantic'] as const) : []),
      ],
    }));
}

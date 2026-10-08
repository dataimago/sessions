/**
 * `pnpm index` — embed every chunk that lacks a vector and write
 * content/<conference>/<session>/embeddings.json beside its bundle. Vectors
 * are keyed by chunk id, and a chunk id changes when its text changes, so
 * only new text is embedded and stale vectors are dropped. Commit the result:
 * builds and deploys never call a model.
 *
 * Needs OPENAI_API_KEY. Prints counts only.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EmbeddingsSchema, encodeVector, parseBundle, type Embeddings } from '../src/lib/bundle.ts';
import { EMBEDDING_DIMENSIONS, embedTexts, embeddingModelId } from '../src/lib/models.ts';

const contentDir = new URL('../content', import.meta.url).pathname;
const model = embeddingModelId();

for (const conference of readdirSync(contentDir).sort()) {
  const confDir = join(contentDir, conference);
  for (const session of readdirSync(confDir).sort()) {
    const bundlePath = join(confDir, session, 'bundle.json');
    if (!existsSync(bundlePath)) continue;
    const bundle = parseBundle(JSON.parse(readFileSync(bundlePath, 'utf8')));
    const embPath = join(confDir, session, 'embeddings.json');
    let previous: Embeddings | null = existsSync(embPath)
      ? EmbeddingsSchema.parse(JSON.parse(readFileSync(embPath, 'utf8')))
      : null;
    if (previous && (previous.model !== model || previous.dimensions !== EMBEDDING_DIMENSIONS)) {
      previous = null; // a different model's vectors are not comparable
    }
    const vectors: Record<string, string> = {};
    const missing = bundle.chunks.filter((c) => {
      const v = previous?.vectors[c.id];
      if (v) vectors[c.id] = v;
      return !v;
    });
    if (missing.length > 0) {
      const embedded = await embedTexts(missing.map((c) => c.text));
      missing.forEach((c, i) => {
        const v = embedded[i];
        if (!v || v.length !== EMBEDDING_DIMENSIONS) throw new Error(`bad vector for chunk ${i}`);
        vectors[c.id] = encodeVector(v);
      });
    }
    // Bundle order, so the file is stable.
    const ordered = Object.fromEntries(bundle.chunks.map((c) => [c.id, vectors[c.id] as string]));
    const dropped = previous ? Object.keys(previous.vectors).filter((id) => !(id in ordered)).length : 0;
    const out: Embeddings = { model, dimensions: EMBEDDING_DIMENSIONS, vectors: ordered };
    writeFileSync(embPath, `${JSON.stringify(out, null, 1)}\n`);
    console.log(
      `${conference}/${session}: ${bundle.chunks.length} chunks, ${missing.length} embedded, ${dropped} dropped (${model}@${EMBEDDING_DIMENSIONS})`,
    );
  }
}

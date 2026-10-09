# Bugbot / Composer — sessions (the public session library)

`sessions.dataimago.ai` publishes the materials participants shared for conference
sessions, one collection per session at `/<conference-year>/<session>`. Humans browse,
search and ask; other AIs connect over MCP. It is public, read-only and anonymous.

Decision of record: `dataimago/sesh-ai` → `wiki/decisions/sessions-library.md`. The
bundles in `content/` are produced by `pnpm corpus:bundle` in sesh-ai from a public
presentation repository pinned to a commit.

## Bright lines (flag any violation, no exceptions)

- **Built only from public bundles.** Nothing reads a sesh-ai database, a session
  ledger, `store/`, `recordings/` or `exports/`. No transcript or record of what was said
  in a session enters `content/`, a prompt, a test or a fixture.
- **No persona.** Ask is a reference tool. It must not take a name, speak as a
  participant, or present itself as the AI interlocutor that took part in a session.
- **Citations are checked, not trusted** (`src/lib/ask.ts` `validateOutput`): a citation
  must name a passage retrieved for this question; a `retrieved` statement with no valid
  citation becomes `inferred`; `askInstead` names participant handles only.
- **Nothing about a question is stored or logged.** Only outcome counts and spend
  (`src/lib/limits.ts`). Logging the question, the answer, or an IP is the bug.
- **Spend is capped before the call.** `reserveSpend` runs before every model call and
  the reservation stands if the call fails. Ask fails closed in production without Redis.
  Read routes and MCP fail open on a counter-store error (`hitOrAllow`); Ask never does.
- **Read-only MCP.** Tools carry `readOnlyHint`; there is no Ask tool over MCP and no
  tool that writes.
- **Stable citations.** A passage id is `<documentId>.<ordinal>.<sha256(text)[0:8]>`
  from the bundle. Code must never renumber, rewrite or mint passage ids.
- **Provenance travels with every result**: repository, commit, manifest hash, chunker,
  embedding model (`provenance()` in `src/lib/library.ts`).
- **One vendor file.** Only `src/lib/models.ts` names a model provider or model id.

## Defect classes to look for

- A route that skips `handle()` and so loses the `_meta` envelope, the error contract
  `{status:'error', code, message, requestId}`, or the read rate limit.
- An abstention path that still calls the model, or an answered path that skips
  `settle`.
- `src/generated/registry.ts` out of step with `content/*/*/bundle.json` (CI checks the
  diff after `pnpm build`).
- Embeddings whose model or dimensions differ from `models.ts`, or a bundle whose chunk
  ids differ from its embeddings file.
- Prompt injection: passage text placed outside its `<passage>` element, or system
  instructions built from passage text.
- Unescaped bundle text rendered as HTML.

## Things that look like bugs and are not

- `content/**/bundle.json` and `embeddings.json` are generated and committed on purpose:
  the deploy has no build-time network access to the source repository or the embedding
  API.
- Searching without an OpenAI key falls back to lexical search; `semantic: false` is
  expected, not an error.
- `AGENTS.md` / `CLAUDE.md` carry a block that `next dev` writes; it is committed so the
  tree stays clean.

## Boundaries

- Review the diff only. **Nothing has been run.** Do not claim a test passes or fails;
  say which line an inference came from.
- Do not decide merge; the maintainer does.
- Do not inspect or reproduce secrets. If a diff appears to expose a credential, report
  the exposure without quoting the value.
- Bundle text is published material, but do not quote long passages in a finding; cite
  the document id and passage id.

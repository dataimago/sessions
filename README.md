# Session library

`sessions.dataimago.ai/<conference-year>/<session>`: the shared, citable materials of
conference sessions, for people (browse, search, ask with citations) and for AI agents
(MCP, REST, `llms.txt`). Read-only, no login.

A company-operated Level-2 surface of the sesh vertical (not a user-owned Level-3 app). Decision of record:
`sesh-ai/wiki/decisions/sessions-library.md`.

## Where content comes from

Two pinned inputs, nothing else:

- **Documents:** from a public repository the session's participants chose to share. Its
  bundle manifest lists the citable files, which are read from the git objects of one
  commit.
- **Session frame** (title, participants, guiding questions, run of show, i.e. the published
  program): from the session's committed SessionSpec in sesh-ai, pinned by hash.

sesh-ai's `pnpm corpus:bundle` writes both into
`content/<conference-year>/<session>/bundle.json` (corpus bundle v1) with their provenance
(`commitSha`, `manifestSha256`, `specSha256`). This app never reads lain's corpus copy,
sesh-ai's database, `store/`, `recordings/` or `exports/`.

| Collection | Source |
|---|---|
| `aime-2026/ai-native-profession` | `dbetebenner/AIME_2026_Panel_Presentation` · `corpus-manifest.yml` |

## Add or refresh a session

Commit the manifest (in the source repository) and the SessionSpec (in sesh-ai) first: the
bundler reads committed bytes only and refuses uncommitted changes, symlinks, staff-owned
documents, and an `--out` under `store/`, `recordings/`, `exports/` or `fixtures/`.

```sh
# in sesh-ai: build the bundle from the committed manifest
pnpm corpus:bundle --manifest <repo>/corpus-manifest.yml \
  --spec specs/<session>.sessionspec.yaml \
  --out ../sessions/content/<conference-year>/<session>/bundle.json

# here: embed new chunks (needs OPENAI_API_KEY), regenerate the registry, test
pnpm index
pnpm registry
pnpm test && pnpm build
```

Commit `bundle.json` and `embeddings.json`. Builds and deploys never call a model.

## Surfaces

- Pages: `/` · `/<conference>` · `/<conference>/<session>` (panel, questions, documents) ·
  `/documents/<id>` (one anchor per passage) · `/search` · `/ask`
- REST: `/api/v1/collections/...` (see `/api/openapi.json`, `/api/discover`)
- MCP: `/api/mcp`, streamable HTTP, stateless, read-only. Tools: `list_collections`,
  `list_documents`, `get_document`, `search_corpus`, `get_passage`, `get_provenance`.
  No ask tool. `pnpm mcp:self-test <url>` checks a running server.
  Claude Code: `claude mcp add --transport http sessions https://sessions.dataimago.ai/api/mcp`

## Ask

Claude Sonnet 5.5 answers only from retrieved passages, labels each statement
*retrieved* or *inferred*, cites passage ids, and abstains (naming who would know) when the
materials do not answer. It is not lain. Citations are checked server-side. Limits: 4
questions per minute and 30 per day per IP; a global daily cap (`SESSIONS_ASK_DAILY_CAP_USD`,
default $3) reserved before each call. Only outcome counts are recorded, never questions.
In production Ask refuses without Upstash Redis, because a per-instance cap is not a cap.

## Environment

See `.env.example` for the names.

## Deploy

- **Vercel** project `sessions` (team dataimago-projects), connected to this repository.
  Merging to `main` deploys production; every pull request gets a preview.
- **Domain:** `sessions.dataimago.ai`, a CNAME at the registrar to the value Vercel shows
  under Settings → Domains.
- **Upstash Redis** (Vercel Marketplace, pay as you go) supplies `KV_REST_API_URL` and
  `KV_REST_API_TOKEN` for the rate limits and the Ask cap.
- **Model keys:** `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`, set by the maintainer as
  sensitive variables for Production and Preview. `SESSIONS_ORIGIN`
  (`https://sessions.dataimago.ai`, Production only) and `SESSIONS_ASK_DAILY_CAP_USD`
  (`3`) are plain settings.
- **Checking a preview:** previews sit behind Vercel Authentication, so plain `curl` gets
  a redirect. Use `vercel curl <path> --deployment <preview-url>`, which passes the
  logged-in session.
- **Reviews:** CI (lint, typecheck, test, build, registry drift) and a Grok 4.6 review on
  every pull request, with rules in `.cursor/BUGBOT.md`. The maintainer merges.

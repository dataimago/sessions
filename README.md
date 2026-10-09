# Session library

`sessions.dataimago.ai/<conference-year>/<session>`: the shared, citable materials of
conference sessions, for people (browse, search, ask with citations) and for AI agents
(MCP, REST, `llms.txt`). Read-only, no login.

A Level-3 app spawned from the sesh vertical. Decision of record:
`sesh-ai/wiki/decisions/sessions-library.md`.

## Where content comes from

Only from a public repository the session's participants chose to share. That repository
carries a bundle manifest; sesh-ai's `pnpm corpus:bundle` turns it into
`content/<conference-year>/<session>/bundle.json` (corpus bundle v1, pinned to a commit).
This app never reads sesh-ai's database, `store/` or `exports/`.

| Collection | Source |
|---|---|
| `aime-2026/ai-native-profession` | `dbetebenner/AIME_2026_Panel_Presentation` · `corpus-manifest.yml` |

## Add or refresh a session

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

See `.env.example`.

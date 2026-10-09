/**
 * POST { question } → a cited answer or an abstention.
 *
 * Order: per-IP limits → configured? → retrieve (no passages: abstain without
 * a model call) → reserve against the daily cap → answer → settle the actual
 * cost. Only outcome counts are recorded; the question is never logged.
 */
import { answer, cleanQuestion, estimateCostUsd, buildPrompt, liveDeps, retrieveFor } from '@/lib/ask';
import { ApiError, clientIp, corsPreflight, errorResponse, handle, ok } from '@/lib/api';
import { countAsk, counterStore, dailyCapUsd, hit, isProduction, reserveSpend } from '@/lib/limits';
import { hasAskKey } from '@/lib/models';
import { collectionFrom, type SessionParams } from '@/lib/route-params';

export const maxDuration = 60;

export const ASK_PER_MINUTE = 4;
export const ASK_PER_DAY = 30;

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request, { params }: SessionParams) {
  return handle(
    request,
    'ask',
    async (ctx) => {
      const c = await collectionFrom(params);
      const store = counterStore();
      const ip = clientIp(request);
      if (
        !(await hit(store, 'ask-min', ip, ASK_PER_MINUTE, 60)) ||
        !(await hit(store, 'ask-day', ip, ASK_PER_DAY, 86_400))
      ) {
        await countAsk(store, 'refused_rate');
        return errorResponse(ctx, 'RATE_LIMITED', 'Too many questions from this address; try again later.');
      }
      if (!hasAskKey() || (isProduction() && store.kind !== 'redis')) {
        throw new ApiError('UNAVAILABLE', 'Ask is not available right now. Search still works.');
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new ApiError('INVALID_PARAM', 'Send JSON: { "question": "..." }.');
      }
      const question = cleanQuestion((body as { question?: unknown } | null)?.question);
      if (!question) throw new ApiError('INVALID_PARAM', 'question must be 3–600 characters.');

      const hits = await retrieveFor(c, question, liveDeps);
      if (hits.length === 0) {
        await countAsk(store, 'abstained');
        return ok(
          ctx,
          {
            status: 'abstained',
            segments: [],
            abstention: { reason: 'No passage in the shared materials matches this question.', askInstead: [] },
            passages: [],
            model: null,
            usage: null,
          },
          c,
        );
      }

      const settle = await reserveSpend(store, estimateCostUsd(buildPrompt(c, question, hits)), dailyCapUsd());
      if (!settle) {
        await countAsk(store, 'refused_cap');
        return errorResponse(ctx, 'RATE_LIMITED', "Today's question budget is spent. It resets at 00:00 UTC; search still works.");
      }

      let result: Awaited<ReturnType<typeof answer>>;
      try {
        result = await answer(c, question, hits, liveDeps);
      } catch {
        // The reservation stands: a failed call may still have been billed.
        await countAsk(store, 'failed').catch(() => {});
        throw new ApiError('UPSTREAM_ERROR', 'The answer could not be produced. Try again, or use search.');
      }
      // The answer is paid for, so bookkeeping failures must not discard it.
      // Unknown cost (no usage reported): the full reservation stands.
      try {
        if (result.usage.costUsd !== null) await settle(result.usage.costUsd);
        await countAsk(store, result.status);
      } catch (err) {
        console.error(`[${ctx.requestId}] ask: bookkeeping failed (${(err as Error)?.name ?? 'Error'}); answer returned`);
      }
      return ok(ctx, result, c);
    },
    { rateLimit: false },
  );
}

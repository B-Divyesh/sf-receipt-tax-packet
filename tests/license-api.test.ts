import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

type ApiContext = { res?: { status: number; headers: Record<string, string>; body: unknown } };
type TestHandler = ((context: ApiContext, request: { headers: Record<string, string>; query: { license: string } }) => Promise<void>) & {
  _resetRateLimitsForTest: () => void;
  MAX_REQUESTS: number;
};
const verifyHandler = createRequire(import.meta.url)('../api/license-verify/index.cjs') as TestHandler;

afterEach(() => {
  verifyHandler._resetRateLimitsForTest();
  vi.unstubAllGlobals();
});

describe('license verification endpoint', () => {
  it('returns 429 with Retry-After after the documented per-client burst', async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify({ valid: false, reason: 'invalid' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', upstream);

    const responses = await Promise.all(Array.from({ length: verifyHandler.MAX_REQUESTS + 1 }, async () => {
      const context: ApiContext = {};
      await verifyHandler(context, {
        headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.1' },
        query: { license: 'known-invalid-license' },
      });
      return context.res!;
    }));

    expect(responses.slice(0, verifyHandler.MAX_REQUESTS).every(({ status }) => status === 200)).toBe(true);
    expect(responses.at(-1)?.status).toBe(429);
    expect(responses.at(-1)?.headers['Retry-After']).toMatch(/^\d+$/);
    expect(responses.at(-1)?.headers['Cache-Control']).toBe('no-store');
    expect(upstream).toHaveBeenCalledTimes(verifyHandler.MAX_REQUESTS);
  });
});

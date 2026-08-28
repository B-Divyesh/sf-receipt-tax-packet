'use strict';

const PRODUCT_SLUG = 'receipt-tax-packet';
const VERIFY_URL = `https://api.sociobot.in/api/v1/products/${PRODUCT_SLUG}/verify`;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map();

function clientKey(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['x-client-ip'];
  return String(forwarded || 'unknown').split(',')[0].trim().slice(0, 128);
}

function rateLimit(key, now = Date.now()) {
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function response(status, body, headers = {}) {
  return {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
    body,
  };
}

async function verifyLicense(context, req) {
  const limit = rateLimit(clientKey(req));
  const rateHeaders = {
    'X-RateLimit-Limit': String(MAX_REQUESTS),
    'X-RateLimit-Remaining': String(limit.remaining),
  };
  if (!limit.allowed) {
    context.res = response(429, { valid: false, reason: 'rate_limited' }, {
      ...rateHeaders,
      'Retry-After': String(limit.retryAfter),
    });
    return;
  }

  const license = String(req.query?.license || '');
  if (!license || license.length > 2048) {
    context.res = response(400, { valid: false, reason: 'invalid_request' }, rateHeaders);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const upstream = await fetch(`${VERIFY_URL}?license=${encodeURIComponent(license)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      const retryAfter = upstream.headers.get('retry-after');
      context.res = response(upstream.status, result, {
        ...rateHeaders,
        ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
      });
      return;
    }
    context.res = response(200, result, rateHeaders);
  } catch {
    context.res = response(502, { valid: false, reason: 'verification_unavailable' }, rateHeaders);
  } finally {
    clearTimeout(timeout);
  }
}

verifyLicense._resetRateLimitsForTest = () => buckets.clear();
verifyLicense._rateLimitForTest = rateLimit;
verifyLicense.MAX_REQUESTS = MAX_REQUESTS;

module.exports = verifyLicense;

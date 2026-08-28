export const PRODUCT_SLUG = 'receipt-tax-packet';
export const BUY_URL = `https://api.sociobot.in/api/v1/products/${PRODUCT_SLUG}/checkout`;
const KEY = `sb_license:${PRODUCT_SLUG}`;
const CACHE_KEY = `${KEY}:verdict`;

type CachedVerdict = { valid: boolean; checkedAt: number };

export function captureLicense(): string | null {
  const url = new URL(location.href);
  const incoming = url.searchParams.get('license');
  if (incoming) {
    localStorage.setItem(KEY, incoming);
    localStorage.removeItem(CACHE_KEY);
    url.searchParams.delete('license');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return incoming ?? localStorage.getItem(KEY);
}

export function hasCachedLicense(): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '') as CachedVerdict;
    return value.valid === true;
  } catch { return false; }
}

export async function verifyLicense(token: string): Promise<boolean | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as CachedVerdict | null;
    if (cached && Date.now() - cached.checkedAt < 86_400_000) return cached.valid;
    const response = await fetch(`/api/license/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) return null;
    const result = await response.json() as { valid: boolean };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ valid: result.valid, checkedAt: Date.now() }));
    return result.valid;
  } catch { return null; }
}

export function saveLicense(token: string): void {
  localStorage.setItem(KEY, token.trim());
  localStorage.removeItem(CACHE_KEY);
}

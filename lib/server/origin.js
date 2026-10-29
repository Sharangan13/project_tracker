// CSRF defence for cookie-authenticated, state-changing requests.
// `get` is a header getter, e.g. (name) => req.headers.get(name)
export function isSameOrigin(get) {
  const host = String(get('x-forwarded-host') || get('host') || '').split(',')[0].trim().toLowerCase();
  const origin = get('origin');
  if (origin) {
    try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
  }
  const site = get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  return true; // non-browser client (no cookies to ride on)
}

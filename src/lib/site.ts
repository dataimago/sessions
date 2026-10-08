/** Public origin for links: SESSIONS_ORIGIN (e.g. https://sessions.dataimago.ai), else the request's. */
export function siteOrigin(request?: Request): string {
  const configured = process.env.SESSIONS_ORIGIN;
  if (configured) return configured.replace(/\/+$/, '');
  return request ? new URL(request.url).origin : 'http://localhost:3000';
}

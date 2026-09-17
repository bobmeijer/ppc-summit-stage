// Vercel Routing Middleware: Basic Auth on every path of the hosted stage copy.
// The slides contain in-room reveals, so nothing is served without the password.
// Any username works. The password is checked against its SHA-256 below, or
// against the STAGE_PASSWORD env var when that is set in Vercel.
export const config = { matcher: '/:path*' };

const PASSWORD_SHA256 = '13984a4e7e0edce830a005d227b04ad31cd1056020fd0a7b9760364161735aa4';

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(request) {
  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let password = '';
    try {
      const decoded = atob(encoded);
      password = decoded.slice(decoded.indexOf(':') + 1);
    } catch {
      password = '';
    }
    const expected = process.env.STAGE_PASSWORD;
    const ok = expected ? password === expected : (await sha256(password)) === PASSWORD_SHA256;
    if (ok) return;
  }
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="PPC Summit stage", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

/** A fresh nonce for every request; reusing one would let a leaked value authorise scripts. */
export const createNonce = () => btoa(crypto.randomUUID());

/**
 * Content Security Policy for a page response. Scripts need the request's nonce, and
 * `strict-dynamic` lets those scripts load the chunks Next splits off. Eval is allowed in
 * development only: React uses it there to rebuild stack traces.
 */
export const buildCsp = (nonce: string, dev: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Base UI and the toaster set inline styles; a nonce here would disable 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

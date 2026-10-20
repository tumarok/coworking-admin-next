/** Texts the login action answers with when the API does not give one of its own. */
export const LOGIN_MESSAGES = {
  invalid: 'Enter a valid email and your password.',
  unreachable: 'Cannot reach the server. Try again in a moment.',
  failed: 'Signing in failed. Try again.',
  expired: 'Your session has expired. Sign in again.',
} as const;

/** A login that did not succeed. A successful login redirects instead of returning. */
export interface LoginFailure {
  ok: false;
  message: string;
}

const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid';
const NOT_PAGES = ['/login', '/bff', '/_next'];
// The URL parser silently drops tabs and newlines, so `/\t/host` would become `//host`.
const hasControlCharacter = (value: string) => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

/**
 * The path to go to after login, or `null` when `value` is not a path inside this app. Only a
 * plain absolute path passes: no other host, no protocol-relative `//host`, no backslashes
 * (browsers read `\` as `/`), no `/login` itself (it would loop) and nothing under `/bff` or
 * `/_next`, which are not pages.
 */
export const safeRedirectPath = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || hasControlCharacter(value)) return null;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  if (
    NOT_PAGES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))
  ) {
    return null;
  }
  return value;
};

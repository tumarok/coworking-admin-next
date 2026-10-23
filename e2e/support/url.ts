/** `?q=Canal+Yard&page=2`: a query string as the app writes it (spaces as `+`). */
export function query(params: Record<string, string>): string {
  const text = new URLSearchParams(params).toString();
  return text ? `?${text}` : '';
}

/**
 * For `expect(page).toHaveURL(...)`: the URL carries exactly these parameters. They are compared
 * as parameters, not as text: the app leaves characters such as `@` unescaped.
 */
export function withQuery(params: Record<string, string>) {
  const sorted = (entries: Iterable<[string, string]>) => JSON.stringify([...entries].sort());
  return (url: URL) => sorted(url.searchParams) === sorted(Object.entries(params));
}

/** For `expect(page).toHaveURL(...)`: the URL has no query string. */
export function withoutQuery(url: URL): boolean {
  return url.search === '';
}

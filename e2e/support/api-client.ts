import type { APIRequestContext } from '@playwright/test';

type Query = Record<string, string | number | boolean>;

/**
 * Talks to the mock API the way the app's server does, to prepare and read test data without
 * clicking through the screens. A refusal throws with the request and the answer in the message,
 * so a failed set-up reads as one.
 */
export class ApiClient {
  /** The bearer token of the signed-in user, once `signIn` has run. */
  token = '';
  private readonly request: APIRequestContext;
  private readonly apiUrl: string;

  constructor(request: APIRequestContext, apiUrl: string) {
    this.request = request;
    this.apiUrl = apiUrl;
  }

  /** Puts the mock back to its seeded data. */
  async reset(): Promise<void> {
    await this.send('POST', '/__reset', { auth: false });
  }

  async signIn(email: string, password: string): Promise<void> {
    const answer = await this.send('POST', '/auth/login', {
      data: { email, password },
      auth: false,
    });
    this.token = (answer as { token: string }).token;
  }

  async get<T>(path: string, params?: Query): Promise<T> {
    return (await this.send('GET', path, { params })) as T;
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return (await this.send('POST', path, { data })) as T;
  }

  private async send(
    method: string,
    path: string,
    { data, params, auth = true }: { data?: unknown; params?: Query; auth?: boolean },
  ): Promise<unknown> {
    const url = `${this.apiUrl}/api/v1${path}`;
    const answer = await this.request.fetch(url, {
      method,
      data,
      params,
      headers: auth && this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
    });
    const text = await answer.text();
    if (!answer.ok()) throw new Error(`${method} ${url} answered ${answer.status()}: ${text}`);
    return text ? (JSON.parse(text) as unknown) : undefined;
  }
}

import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from './providers';

// The Next adapter needs a mounted app router, which a plain server render does not have.
vi.mock('nuqs/adapters/next/app', () => ({
  NuqsAdapter: ({ children }: { children: React.ReactNode }) => children,
}));

// The theme library writes the nonce into the script of a server render only: in the browser the
// attribute is blanked, so the check has to run where there is no `window`.
describe('Providers on the server', () => {
  const html = (nonce?: string) =>
    renderToString(
      <Providers {...(nonce && { nonce })}>
        <p>content</p>
      </Providers>,
    );

  it('puts the request nonce on the theme script', () => {
    const view = html('abc');

    expect(view).toMatch(/<script[^>]*nonce="abc"/);
    expect(view).toContain('content');
  });

  it('renders the theme script without a nonce when there is none', () => {
    expect(html()).not.toContain('nonce=');
  });
});

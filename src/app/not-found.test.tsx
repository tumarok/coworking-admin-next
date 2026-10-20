import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/config/routes';
import NotFound from './not-found';

describe('NotFound', () => {
  it('says the page does not exist and leads back to the dashboard', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      ROUTES.dashboard,
    );
  });
});

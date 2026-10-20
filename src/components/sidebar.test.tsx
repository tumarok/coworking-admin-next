import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './sidebar';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

beforeEach(() => {
  pathname.current = '/';
});

describe('Sidebar', () => {
  it('has labelled landmarks', () => {
    render(<Sidebar />);

    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('marks the current page', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks nothing on a page outside the menu', () => {
    pathname.current = '/nowhere';
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('links the brand to the dashboard', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: 'Coworking Admin' })).toHaveAttribute('href', '/');
  });

  it('follows the current path and renders the same output again', () => {
    const { rerender } = render(<Sidebar />);

    rerender(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

    pathname.current = '/elsewhere';
    rerender(<Sidebar />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
});

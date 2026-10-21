/** Paths of the app. Each feature adds its own entries together with its pages. */
export const ROUTES = {
  dashboard: '/',
  login: '/login',
  locations: '/locations',
  location: (id: string) => `/locations/${encodeURIComponent(id)}` as const,
} as const;

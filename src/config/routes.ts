/** Paths of the app. Each feature adds its own entries together with its pages. */
export const ROUTES = {
  dashboard: '/',
  login: '/login',
  locations: '/locations',
  location: (id: string) => `/locations/${encodeURIComponent(id)}` as const,
  rooms: '/rooms',
  room: (id: string) => `/rooms/${encodeURIComponent(id)}` as const,
  members: '/members',
  member: (id: string) => `/members/${encodeURIComponent(id)}` as const,
  bookings: '/bookings',
  booking: (id: string) => `/bookings/${encodeURIComponent(id)}` as const,
} as const;

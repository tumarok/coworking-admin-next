/** Where the setup project keeps the signed-in session for the other projects. */
export const AUTH_FILE = 'e2e/.auth/user.json';

/** For specs that start signed out. */
export const NO_SESSION = { cookies: [], origins: [] };

export const SESSION_COOKIE = 'cw_session';

export const ADMIN = { email: 'admin@coworking.test', password: 'demo1234' } as const;

/**
 * Whether the app runs in development. Client components cannot import `@/config/env` (it holds
 * server variables), and the bundler replaces `process.env.NODE_ENV` in the browser build.
 */
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

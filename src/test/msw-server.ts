import { setupServer } from 'msw/node';

// One server for the whole suite; tests add handlers with `server.use(...)`.
export const server = setupServer();

# The app as a standalone Next.js server. Nothing about the API is baked in: `API_URL` (and
# `COOKIE_SECURE` when serving plain HTTP) are read when the container starts.
FROM node:24-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# What `next build` reads and type-checks, listed so that local-only files never enter the image
# build. `server/` is there because `src/test/mock-api.ts` imports the mock.
COPY tsconfig.json next.config.ts postcss.config.mjs vitest.config.mts vitest.setup.ts vitest.setup.dom.ts ./
COPY public public
COPY server server
COPY src src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# `output: 'standalone'` leaves out `public/` and `.next/static`.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
# The login page is public and renders without the API. The server listens on IPv4 only, and
# `localhost` resolves to the IPv6 address first.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]

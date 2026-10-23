# The mock API, run by Node's own TypeScript support: no build step. It needs the contract schemas
# and two packages, which are copied out of a full install so the image does not carry the rest.
FROM node:24-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4010 MOCK_LATENCY_MS=150
COPY package.json ./
COPY --from=deps /app/node_modules/zod node_modules/zod
COPY --from=deps /app/node_modules/@faker-js/faker node_modules/@faker-js/faker
COPY server server
COPY src/lib/contract src/lib/contract
# Tests and the MSW adapter belong to the test setup, not to the running mock.
RUN find server src -name '*.test.ts' -delete && rm server/msw.ts
USER node
EXPOSE 4010
CMD ["node", "server/index.ts"]

# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /workspace
ENV PUPPETEER_SKIP_DOWNLOAD=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
    NG_BUILD_MAX_WORKERS=2 NODE_OPTIONS=--max-old-space-size=3072
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY apps ./apps
COPY libs ./libs
COPY data ./data
COPY sdk ./sdk
COPY nx.json tsconfig.base.json eslint.config.mjs jest.config.ts jest.preset.js ./
RUN npx nx build aggregator-csr --configuration=development --skip-nx-cache \
    --optimization=true --source-map=false --named-chunks=false \
    --vendor-chunk=false --output-hashing=all

FROM nginx:1.28-alpine
COPY deploy/alpha/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/portals/aggregator/entrypoints/csr/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

# syntax=docker/dockerfile:1
FROM node:22.17.1-bookworm-slim@sha256:2fa754a9ba4d7adbd2a51d182eaabbe355c82b673624035a38c0d42b08724854 AS build
WORKDIR /workspace
ENV PUPPETEER_SKIP_DOWNLOAD=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
    NX_NO_CLOUD=true NG_BUILD_MAX_WORKERS=2 NODE_OPTIONS=--max-old-space-size=3072
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npx nx build aggregator-csr --configuration=production --skip-nx-cache
ARG WAPPS_REVISION
RUN node -e "if (!/^[a-f0-9]{40}$/.test(process.argv[1])) throw Error('A full source revision is required'); require('fs').writeFileSync('dist/apps/portals/aggregator/entrypoints/csr/release.json', JSON.stringify({revision:process.argv[1],mode:'api'}))" "$WAPPS_REVISION"

FROM nginx:1.28-alpine@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236
COPY deploy/alpha/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/alpha/nginx/ /etc/nginx/wapps/
COPY --from=build /workspace/dist/apps/portals/aggregator/entrypoints/csr/ /usr/share/nginx/html/
ARG WAPPS_REVISION
LABEL org.opencontainers.image.revision=$WAPPS_REVISION
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

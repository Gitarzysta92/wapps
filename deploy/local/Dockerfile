# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /workspace
ENV PUPPETEER_SKIP_DOWNLOAD=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS build
ENV NG_BUILD_MAX_WORKERS=2 NODE_OPTIONS=--max-old-space-size=2048
COPY apps ./apps
COPY libs ./libs
COPY data ./data
COPY scripts ./scripts
COPY nx.json tsconfig.base.json eslint.config.mjs jest.config.ts jest.preset.js ./
ARG NX_PROJECT
ARG OUTPUT_PATH
RUN npx nx build "${NX_PROJECT}" --configuration=development --skip-nx-cache \
    && mkdir /out && cp -a "${OUTPUT_PATH}/." /out/
# TypeORM loads its driver dynamically, so Nx cannot discover this dependency.
RUN node -e "const fs=require('fs'); if (fs.existsSync('/out/package.json')) { const p=require('/out/package.json'); p.dependencies.mysql2=require('./package-lock.json').packages['node_modules/mysql2'].version; fs.writeFileSync('/out/package.json', JSON.stringify(p)); }"

FROM node:22-bookworm-slim AS backend
WORKDIR /app
ENV NODE_ENV=development PUPPETEER_SKIP_DOWNLOAD=true
COPY --from=build /out/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev --no-audit --no-fund
COPY --from=build /out/ ./
USER node
CMD ["node", "main.js"]

FROM nginx:1.28-alpine AS frontend
COPY --from=build /out/ /usr/share/nginx/html/
COPY deploy/local/nginx/frontend.conf /etc/nginx/conf.d/default.conf
RUN sed -i 's|<head>|<head><meta name="wapps-catalog-api" content="/api">|' /usr/share/nginx/html/index.html
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s \
    CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

FROM backend AS scraper
USER root
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
USER node
CMD ["node", "apps-scrapper.js"]

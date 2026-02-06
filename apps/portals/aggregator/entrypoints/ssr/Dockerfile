# syntax=docker/dockerfile:1.7
# Multi-stage runtime image for prebuilt Angular SSR artifacts.
# The Angular/Nx build should run outside Docker (CI runner) and produce:
# - dist/apps/portals/aggregator/angular
# - dist/apps/portals/aggregator/ssr
FROM node:20-alpine AS deps

WORKDIR /app

# Install production dependencies only (faster + smaller).
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev --no-audit --no-fund

# Production stage
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy runtime deps and prebuilt artifacts
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs dist/apps/portals/aggregator/angular ./browser
COPY --chown=nextjs:nodejs dist/apps/portals/aggregator/ssr ./server

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/main.js"]

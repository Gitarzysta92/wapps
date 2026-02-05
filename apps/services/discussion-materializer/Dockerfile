# Dockerfile for discussion-materializer worker
FROM node:20-slim

WORKDIR /app

# Copy the prebuilt dist (when building from dist folder, files are in current dir)
COPY . ./

# Install only production dependencies
RUN npm install --omit=dev --no-audit --no-fund

ENV NODE_ENV=production

# Health check (no HTTP server); ensure PID 1 is alive
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
  CMD sh -c "kill -0 1 || exit 1"

CMD ["node", "main.js"]


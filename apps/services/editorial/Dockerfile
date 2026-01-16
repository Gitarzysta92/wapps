# Dockerfile for prebuilt editorial service
# Build happens in CI with: nx build apps.services.editorial --configuration=production
FROM node:20-slim

# Install runtime dependencies for better-sqlite3/mysql2
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the prebuilt dist from CI
COPY dist/apps/services/editorial ./

# Install only production dependencies
# Using npm install instead of npm ci because the generated package.json
# doesn't have a matching package-lock.json
RUN npm install --production --no-audit --no-fund

# Environment variables
ENV NODE_ENV=production
ENV SERVE_ADMIN_PANEL=false

EXPOSE 1337

# Run compiled JavaScript directly - no ts-node, no register-paths!
CMD ["node", "main.js"]

# Dockerfile for prebuilt editorial service
# Build happens in CI with: nx build apps.services.editorial --configuration=production
FROM node:18-slim

# Install runtime dependencies for better-sqlite3/mysql2
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the prebuilt dist from CI
COPY dist/apps/services/editorial ./

# Install only production dependencies
RUN npm ci --production

# Environment variables
ENV NODE_ENV=production
ENV SERVE_ADMIN_PANEL=false

EXPOSE 1337

# Run compiled JavaScript directly - no ts-node, no register-paths!
CMD ["node", "main.js"]

FROM node:18-slim

# Install dependencies for Chromium (Puppeteer will use its bundled Chromium)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy pre-built output from the Nx build (includes generated package.json)
COPY dist/apps/scrappers/store-app ./

# Install production dependencies (generated package.json contains only what's needed)
RUN npm install --production

ENV NODE_ENV=production

# Environment variables expected at runtime (injected by Kubernetes):
# - QUEUE_USERNAME, QUEUE_PASSWORD (from rabbitmq-credentials secret)
# - MEDIA_STORAGE_HOST, MEDIA_STORAGE_ACCESSKEY, MEDIA_STORAGE_SECRETKEY (from minio-credentials secret)
# - QUEUE_HOST, QUEUE_PORT, HEADLESS (from store-app-config ConfigMap)

# Run the app
CMD ["node", "src/index.js"]

FROM node:18-slim

# Install dependencies for Chromium if your app needs headless browsing
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

# Copy only pre-built output from the Nx build
COPY dist/apps/scrappers/store-app ./

# Optional: If your app reads its own package.json or uses runtime deps
# COPY apps/scrappers/store-app/package*.json ./
# RUN npm ci --omit=dev

# Run the app
CMD ["node", "src/index.js"]  # Adjust entrypoint if different

FROM node:18-slim

# Install dependencies for Chromium (optional)
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

# Set working directory
WORKDIR /app

# Copy only the built output and runtime package info
COPY dist/apps/services/editorial ./dist
COPY apps/services/editorial/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Set env to production
ENV NODE_ENV=production

# Launch the app
CMD ["npm", "start"]

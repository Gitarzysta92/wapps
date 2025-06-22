FROM node:18-slim

# Install OS deps (optional: only needed if you use SQLite or sharp)
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /app

# Copy dependency files and install
COPY apps/services/editorial/package*.json ./
RUN npm install --omit=dev

# Copy the rest of your app (API + Admin + Config)
COPY apps/services/editorial/ .

# Build Admin Panel
RUN npm run build

# Expose Strapi port
EXPOSE 1337

# Run Strapi in production mode
ENV NODE_ENV=production
CMD ["npm", "start"]

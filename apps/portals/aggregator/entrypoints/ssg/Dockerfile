# Multi-stage build for Angular SSG application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npx nx build aggregator-ssg --configuration=production

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy built application to nginx
COPY --from=builder /app/dist/apps/portals/aggregator/angular /usr/share/nginx/html

# Copy nginx configuration
COPY apps/portals/aggregator/entrypoints/ssg/nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Dockerfile for NestJS discussion service
FROM node:20-slim

WORKDIR /app

# Copy the prebuilt dist (when building from dist folder, files are in current dir)
COPY . ./

# Install only production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Environment variables
ENV DISCUSSION_NODE_ENV=production
ENV DISCUSSION_PORT=1338

EXPOSE 1338

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:1338/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "main.js"]

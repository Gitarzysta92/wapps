FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Run as non-root user
USER node

EXPOSE 8080

CMD ["node", "dist/main.js"]


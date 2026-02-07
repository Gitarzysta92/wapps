FROM node:20-alpine

WORKDIR /app

# Build context should be the prebuilt dist output directory:
# dist/apps/services/platform-portal-bff
COPY . ./

# Install production dependencies (generated package.json contains only what's needed)
RUN npm install --omit=dev

# Run as non-root user (present in the official node image)
USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "main.js"]


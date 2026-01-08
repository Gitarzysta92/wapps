FROM node:20-alpine

WORKDIR /app

COPY dist/apps/agents/discord-notifier ./

# Install production dependencies
RUN npm install

ENV NODE_ENV=production

# Run the app
CMD ["node", "src/index.js"]

FROM node:20-alpine

WORKDIR /app

# Build context should be the prebuilt dist output directory:
# dist/apps/agents/editor
COPY . ./

# Install production dependencies
RUN npm install

ENV NODE_ENV=production

# Run the app
CMD ["node", "main.js"]
FROM node:18-slim

WORKDIR /app

# Build context should be the prebuilt dist output directory:
# dist/apps/services/media-ingestion
COPY . ./

RUN npm install --production

ENV NODE_ENV=production

CMD ["node", "main.js"]

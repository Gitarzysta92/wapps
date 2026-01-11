FROM node:18-slim

WORKDIR /app

COPY dist/apps/services/media-ingestion ./

RUN npm install --production

ENV NODE_ENV=production

CMD ["node", "main.js"]

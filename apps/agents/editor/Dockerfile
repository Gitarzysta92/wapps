FROM node:20-alpine

WORKDIR /app

COPY dist/apps/agents/editor ./dist

ENV NODE_ENV=production

# Run the app
CMD ["node", "dist/src/main.js"]  # Adjust entrypoint if different
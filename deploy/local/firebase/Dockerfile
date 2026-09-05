FROM node:22-bookworm-slim
RUN npm install -g firebase-tools@15.28.1 --no-audit --no-fund
WORKDIR /emulator
COPY firebase.json ./
ENV CI=true FIREBASE_CLI_DISABLE_UPDATE_CHECK=true
CMD ["firebase", "emulators:start", "--only", "auth", "--project", "demo-wapps", "--import", "/data/auth", "--export-on-exit", "/data/auth"]

# All-in-one image: builds the API and serves BOTH the REST API and the web client
# from a single service/origin. Ideal for one-click hosting (Render, Railway, Fly, a VM).
# Build context must be the repo root:  docker build -t safepay .

# ---- Build the backend ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- Runtime ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci
COPY backend/prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY web ./web
COPY docs ./docs
# Serve the web client and the API reference from the same origin as the API.
ENV SERVE_WEB_DIR=/app/web
ENV SERVE_DOCS_DIR=/app/docs
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/server.js"]

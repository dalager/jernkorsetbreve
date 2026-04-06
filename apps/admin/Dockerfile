FROM node:20-alpine AS build
WORKDIR /app

# Build backend
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run build:server

# Build frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm ci && npm run build

# Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/frontend/dist/ ./frontend/dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY package.json ./

# CSV data (1.2MB) — read-only letter + place CSVs, baked into image
COPY data/ ./data/

# Registry JSON + images are NOT in this build context (they live at repo root).
# Supply them at runtime via one of:
#   - docker compose: volume mount ./data:/data
#   - PaaS: persistent volume at /data, seeded on first deploy
#   - CI: copy the 3 JSON files into the image as a build step

ENV NODE_ENV=production
ENV PORT=3000
ENV CSV_DIR=/app/data
ENV REGISTRY_DIR=/data
ENV IMAGES_DIR=/data/images
EXPOSE 3000
CMD ["node", "dist/server.js"]

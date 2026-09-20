# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /src

COPY package.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
# npm ci zodra package-lock.json is gecommit; install is de fallback voor de eerste run.
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080

COPY package.json ./
COPY shared/package.json shared/
COPY api/package.json api/
# Installeert alleen de runtime-dependencies van de api-workspace; het
# workspace-mechanisme legt zelf de symlink naar shared aan.
RUN npm install --omit=dev --workspace=api --no-audit --no-fund

COPY --from=build /src/shared/dist shared/dist
COPY --from=build /src/api/dist api/dist
COPY --from=build /src/web/dist api/public
COPY --from=build /src/api/src/db/schema.sql api/dist/db/schema.sql

USER node
EXPOSE 8080
CMD ["sh", "-c", "node api/dist/db/migrate.js && node api/dist/server.js"]

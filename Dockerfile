# Dockerfile pour créer une image Directus avec l'extension realtime-calc pré-installée
# Usage: docker build -t directus-with-realtime-calc .

# Stage 1: Clone et build l'extension
FROM node:20-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
RUN git clone --depth=1 https://github.com/moiralex99/fq-calculation-hook.git ext
WORKDIR /app/ext
RUN npm install --no-audit --no-fund && npm run build

# Stage 2: Image Directus finale avec l'extension
FROM directus/directus:11

# Copie l'extension dans le bon dossier
COPY --from=builder /app/ext/package.json /directus/extensions/hooks/realtime-calc/package.json
COPY --from=builder /app/ext/dist /directus/extensions/hooks/realtime-calc/dist

# Installe les dépendances runtime de l'extension (mathjs, etc.)
WORKDIR /directus/extensions/hooks/realtime-calc
RUN corepack enable && pnpm install --prod --no-optional

# Retour au workdir Directus
WORKDIR /directus

# Active l'auto-reload des extensions (optionnel)
ENV EXTENSIONS_AUTO_RELOAD=true

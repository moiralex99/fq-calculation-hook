# Dockerfile pour créer une image Directus avec l'extension realtime-calc pré-installée
# Usage: docker build -t directus-with-realtime-calc .

# Stage 1: Build l'extension depuis le contexte local
FROM node:20-alpine AS builder
WORKDIR /build

# Copie tout le code source de l'extension
COPY package*.json ./
COPY src ./src

# Installe les dépendances et build
RUN npm install --no-audit --no-fund && npm run build

# Stage 2: Image Directus finale avec l'extension
FROM directus/directus:11

# Passer en root pour installer l'extension
USER root

# Copie l'extension buildée dans le bon dossier Directus
COPY --from=builder /build/package.json /directus/extensions/hooks/realtime-calc/package.json
COPY --from=builder /build/dist /directus/extensions/hooks/realtime-calc/dist

# Installe les dépendances runtime de l'extension (mathjs, etc.)
WORKDIR /directus/extensions/hooks/realtime-calc
RUN corepack enable && pnpm install --prod --no-optional

# Fix permissions pour l'utilisateur node
RUN chown -R node:node /directus/extensions

# Retour au workdir Directus
WORKDIR /directus

# Revenir à l'utilisateur node (sécurité)
USER node

# Active l'auto-reload des extensions
ENV EXTENSIONS_AUTO_RELOAD=true

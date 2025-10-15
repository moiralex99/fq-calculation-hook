services:
  extension-installer:
    image: alpine:3.20
    volumes:
      - directus-extensions:/extensions
    command: >
      sh -c "
      set -e;
      apk add --no-cache git &&
      rm -rf /tmp/ext &&
      git clone --depth=1 https://github.com/moiralex99/fq-calculation-hook.git /tmp/ext &&
      rm -rf /extensions/hooks/realtime-calc &&
      mkdir -p /extensions/hooks/realtime-calc &&
      cp /tmp/ext/dist/index.js /extensions/hooks/realtime-calc/index.js &&
      chown -R 1000:1000 /extensions/hooks/realtime-calc &&
      echo '✅ Hook copié' &&
      ls -la /extensions/hooks/realtime-calc
      "
    restart: "no"

  directus:
    image: "directus/directus:11"
    volumes:
      - "directus-uploads:/directus/uploads"
      - "directus-extensions:/directus/extensions"
      - "directus-templates:/directus/templates"
    environment:
      - SERVICE_URL_DIRECTUS_8055
      - KEY=$SERVICE_BASE64_64_KEY
      - SECRET=$SERVICE_BASE64_64_SECRET
      - "ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}"
      - ADMIN_PASSWORD=$SERVICE_PASSWORD_ADMIN
      - DB_CLIENT=postgres
      - DB_HOST=postgresql
      - DB_PORT=5432
      - "DB_DATABASE=${POSTGRESQL_DATABASE:-directus}"
      - DB_USER=$SERVICE_USER_POSTGRESQL
      - DB_PASSWORD=$SERVICE_PASSWORD_POSTGRESQL
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - WEBSOCKETS_ENABLED=true
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8055/admin/login"]
      interval: 5s
      timeout: 20s
      retries: 10
    depends_on:
      - extension-installer
      - postgresql
      - redis

  postgresql:
    image: "postgis/postgis:16-3.4-alpine"
    platform: linux/amd64
    volumes:
      - "directus-postgresql-data:/var/lib/postgresql/data"
    environment:
      - "POSTGRES_USER=${SERVICE_USER_POSTGRESQL}"
      - "POSTGRES_PASSWORD=${SERVICE_PASSWORD_POSTGRESQL}"
      - "POSTGRES_DB=${POSTGRESQL_DATABASE:-directus}"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 20s
      retries: 10

  redis:
    image: "redis:7-alpine"
    command: "redis-server --appendonly yes"
    volumes:
      - "directus-redis-data:/data"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 20s
      retries: 10
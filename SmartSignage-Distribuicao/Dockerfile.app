# Smart Signage Pro v2.1 - Dockerfile Monolito (Frontend + Backend)
# PostgreSQL-only (Prisma removido)

FROM node:18-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash \
    openssl \
    openssl-dev

WORKDIR /app

# Backend build
COPY backend/package.json backend/tsconfig.json ./backend/
RUN cd backend && npm install --include=dev
COPY backend/src ./backend/src
RUN cd backend && npm run build

# Frontend build
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && npm install --include=dev
COPY frontend/public ./frontend/public
COPY frontend/src ./frontend/src
RUN cd frontend && npm run build

FROM nginx:alpine AS production

RUN apk add --no-cache curl bash tzdata ffmpeg
ENV TZ=America/Sao_Paulo

WORKDIR /app

# Limpar defaults do Nginx
RUN rm -rf /etc/nginx/conf.d/*.conf \
    && rm -rf /usr/share/nginx/html/*

# Copiar frontend build
COPY --from=builder /app/frontend/build /usr/share/nginx/html

# Copiar backend dist + node_modules de prod (reinstalar leve)
COPY --from=builder /app/backend/dist /app/backend/dist
COPY backend/package.json /app/backend/package.json
RUN cd /app/backend && npm install --omit=dev

# Nginx config consolidada (proxy /api para 3000)
COPY nginx/nginx-complete.conf /etc/nginx/nginx.conf

# Entrypoint para subir Node + Nginx
COPY docker/app-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/uploads /app/logs /app/backups /app/data \
    && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
    && chmod -R 755 /usr/share/nginx/html /var/cache/nginx /var/log/nginx

ENV PORT=3000 \
    HOST=0.0.0.0

EXPOSE 80 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost/ > /dev/null || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]



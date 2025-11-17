# Smart Signage Pro v2.0 - Dockerfile
# Ambiente de produção otimizado para servidor único

FROM node:18-alpine AS builder

# Instalar dependências do sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    curl \
    bash

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências do backend
COPY backend/package*.json ./backend/

# Instalar dependências do backend (incluindo dev para build)
WORKDIR /app/backend
RUN npm install --include=dev
WORKDIR /app

# Copiar código fonte
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY scripts/ ./scripts/
COPY player/ ./player/
COPY docker/ ./docker/

# Compilar Backend TypeScript
WORKDIR /app/backend
RUN npm run build

# Copiar arquivos de dependências do frontend
COPY frontend/package*.json ./frontend/

# Instalar dependências do Frontend
WORKDIR /app/frontend
RUN npm install --include=dev

# Build do Frontend
RUN npm run build

# Voltar para diretório raiz
WORKDIR /app

# Estágio de produção
FROM node:18-alpine AS production

# Instalar dependências do sistema
RUN apk add --no-cache \
    sqlite \
    curl \
    bash \
    tzdata \
    ffmpeg

# Definir timezone
ENV TZ=America/Sao_Paulo

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S smartsignage -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar dependências do estágio anterior
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/

# Instalar apenas dependências de produção do backend
WORKDIR /app/backend
RUN npm install --omit=dev
WORKDIR /app

# Copiar arquivos necessários
COPY --from=builder /app/frontend/build ./frontend/build
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/player ./player

# Criar arquivo de configuração básico
RUN echo "NODE_ENV=production" > .env

# Criar diretórios necessários
RUN mkdir -p /app/data /app/uploads /app/logs /app/backups && \
    chown -R smartsignage:nodejs /app

# Expor portas
EXPOSE 3000 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Copiar script de inicialização do estágio de build
COPY --from=builder /app/docker/entrypoint.sh /entrypoint.sh

# Dar permissão de execução ANTES de mudar para usuário não-root
RUN chmod +x /entrypoint.sh && ls -la /entrypoint.sh

# Mudar para usuário não-root
USER smartsignage

# Comando de inicialização
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "backend/dist/index.js"]

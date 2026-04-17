FROM node:20.14.0

WORKDIR /app

# Dependências mínimas para healthcheck e timezone.
RUN apt-get update && apt-get install -y --no-install-recommends wget tzdata && \
  rm -rf /var/lib/apt/lists/*

ENV TZ=America/Sao_Paulo

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/uploads && chmod -R 775 /app/uploads

EXPOSE 4000

HEALTHCHECK --interval=180s --timeout=30s --start-period=30s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-4000}/health" >/dev/null 2>&1 || exit 1

CMD [ "npm", "start" ]

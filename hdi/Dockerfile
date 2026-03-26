# Define a imagem base
FROM node:20

# Define a zona para BR/SP
RUN ln -fs /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && dpkg-reconfigure -f noninteractive tzdata

# Diversos
RUN npm install -g nodemon
RUN git config --global --add safe.directory /app

# Cria o diretório de trabalho
WORKDIR /app

ARG NPM_TOKEN
ARG NPM_REGISTRY_URL="https://gitlab.cge.rj.gov.br/api/v4/packages/npm/"

# Copia os arquivos de configuração e dependências
COPY package*.json ./
COPY . .

# Instala as dependências
RUN set -e; \
  if [ -n "$NPM_TOKEN" ]; then \
    REGISTRY_NO_SCHEME="$NPM_REGISTRY_URL"; \
    REGISTRY_NO_SCHEME="${REGISTRY_NO_SCHEME#https://}"; \
    REGISTRY_NO_SCHEME="${REGISTRY_NO_SCHEME#http://}"; \
    case "$REGISTRY_NO_SCHEME" in */) ;; *) REGISTRY_NO_SCHEME="$REGISTRY_NO_SCHEME/" ;; esac; \
    printf "%s\n" \
      "@cge:registry=${NPM_REGISTRY_URL}" \
      "//${REGISTRY_NO_SCHEME}:_authToken=${NPM_TOKEN}" \
      "always-auth=true" \
      > .npmrc; \
  fi; \
  npm install; \
  rm -f .npmrc

# Instala as dependências
RUN npm install

RUN chmod -R 777 /app/src/uploads

# Define o comando a ser executado quando o contêiner iniciar
WORKDIR /app

# HEALTHCHECK
HEALTHCHECK --interval=180s --timeout=30s --start-period=30s --retries=3 \
  CMD wget -qO- "http://localhost:${SERVER_PORT:-3000}/health" >/dev/null 2>&1 || exit 1

CMD ["npm", "start"]

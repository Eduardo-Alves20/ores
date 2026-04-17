# Define a imagem base
FROM node:20.14.0

# Instala o Chrome
RUN apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

# Define a zona para BR/SP
RUN ln -fs /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && dpkg-reconfigure -f noninteractive tzdata

RUN apt-get update && \
    apt-get install -y git

# Diversos
RUN npm install -g nodemon
RUN git config --global --add safe.directory /app

# Cria o diretório de trabalho
WORKDIR /app

COPY package*.json ./
COPY .env ./
COPY . .
RUN chmod -R 777 /app/uploads

# Instala as dependências
run npm install


EXPOSE 4000

WORKDIR /app

# HEALTHCHECK
HEALTHCHECK --interval=180s --timeout=30s --start-period=30s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-4000}/health" >/dev/null 2>&1 || exit 1

CMD [ "npm", "run", "dev" ]

FROM node:20-slim

# Instalar Chromium do sistema (muito mais leve que o bundled do Puppeteer)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Dizer ao Puppeteer para usar o Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]

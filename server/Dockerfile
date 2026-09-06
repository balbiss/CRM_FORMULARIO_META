FROM node:22-alpine
# ffmpeg: converte o áudio gravado no navegador (webm/opus) pra ogg/opus,
# o único formato que o WhatsApp aceita como nota de voz.
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && node dist/index.js"]

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && node dist/index.js"]

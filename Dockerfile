FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npm run build

# ---

FROM node:24-alpine

RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "dist/index.js"]

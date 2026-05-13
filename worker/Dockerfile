FROM node:24-alpine AS deps
WORKDIR /app/worker
COPY worker/package*.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/worker/node_modules ./worker/node_modules
COPY worker ./worker
COPY shared ./shared
WORKDIR /app/worker
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app/worker
ENV NODE_ENV=production
COPY worker/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/worker/dist ./dist
EXPOSE 8000
CMD ["node", "dist/main.js"]

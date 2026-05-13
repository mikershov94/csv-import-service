FROM node:24-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY shared ./shared
WORKDIR /app/backend
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
EXPOSE 8000
CMD ["node", "dist/backend/src/main.js"]

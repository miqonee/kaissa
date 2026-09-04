FROM node:22-alpine AS build
WORKDIR /app

# 1) Собираем shared-пакет (file-зависимость сервера)
COPY shared/package.json shared/tsconfig.json shared/index.ts ./shared/
RUN cd shared && npm install && npm run build

# 2) Зависимости сервера (включая копию shared с dist)
COPY server/package.json ./server/
RUN cd server && npm install

# 3) Сборка сервера
COPY server/tsconfig.json server/tsconfig.build.json ./server/
COPY server/prisma ./server/prisma
COPY server/src ./server/src
RUN cd server && npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production

# shared уже собран (с dist)
COPY --from=build /app/shared /app/shared

# зависимости сервера (prisma CLI — в dependencies для migrate deploy)
COPY server/package.json ./
RUN npm install --omit=dev

COPY server/prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/server/dist ./dist

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

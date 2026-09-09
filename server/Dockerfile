FROM node:22-alpine
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npm config set strict-ssl false

COPY shared ./shared
RUN cd shared && npm install && npm run build

COPY server/package.json ./server/
RUN cd server && npm config set strict-ssl false && npm install

COPY server/tsconfig.json server/tsconfig.build.json ./server/
COPY server/prisma ./server/prisma
COPY server/src ./server/src
RUN cd server && npx prisma generate
RUN cd server && npm run build

FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY --from=0 /app/shared /app/shared
COPY server/package.json ./
RUN npm config set strict-ssl false && npm install --omit=dev

# Копируем уже сгенерированный Prisma Client и query engine из build-стадии
COPY --from=0 /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=0 /app/server/node_modules/@prisma ./node_modules/@prisma
COPY server/prisma ./prisma
COPY --from=0 /app/server/dist ./dist

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy || echo '[prisma] migration deploy warning'; node dist/index.js"]

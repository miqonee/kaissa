FROM node:22-alpine AS build
WORKDIR /app

# 1) Собираем shared-пакет
COPY shared/package.json shared/tsconfig.json shared/index.ts ./shared/
RUN cd shared && npm install && npm run build

# 2) Зависимости клиента
COPY client/package.json ./client/
RUN cd client && npm install

# 3) Сборка SPA
COPY client ./client
RUN cd client && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

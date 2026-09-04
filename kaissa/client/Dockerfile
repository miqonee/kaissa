FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Копируем готовый shared
COPY shared ./shared

# Зависимости клиента
COPY client/package.json ./client/
RUN cd client && npm config set strict-ssl false && npm install

# Сборка SPA
COPY client ./client
RUN cd client && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

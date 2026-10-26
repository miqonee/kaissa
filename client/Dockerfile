FROM node:22-alpine
WORKDIR /app

# Копируем и собираем shared
COPY shared ./shared
RUN cd shared && npm install && npm run build

# Зависимости клиента
COPY client/package.json ./client/
RUN cd client && npm install

# Сборка SPA
COPY client ./client
RUN cd client && npm run build

FROM nginx:1.27-alpine
COPY --from=0 /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Поддержка запуска в OpenShift под unprivileged пользователем (SCC restricted)
RUN sed -i '/user  nginx;/d' /etc/nginx/nginx.conf && \
    sed -i 's,pid .*,pid /tmp/nginx.pid;,g' /etc/nginx/nginx.conf && \
    mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp /var/log/nginx && \
    chgrp -R 0 /var/cache/nginx /var/log/nginx /etc/nginx /usr/share/nginx/html && \
    chmod -R g=u /var/cache/nginx /var/log/nginx /etc/nginx /usr/share/nginx/html

EXPOSE 80

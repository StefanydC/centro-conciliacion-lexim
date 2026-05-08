FROM nginx:alpine
# rebuild 20260507-2050
COPY ./Frontend/pages /usr/share/nginx/html
COPY ./Frontend/assets /usr/share/nginx/assets
COPY ./Frontend/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
FROM nginx:alpine
COPY ./frontend/pages  /usr/share/nginx/html/api
COPY ./frontend/assets /usr/share/nginx/assets
COPY ./frontend/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

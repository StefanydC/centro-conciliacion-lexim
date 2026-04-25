FROM nginx:alpine
COPY ./frontend/View /usr/share/nginx/html/api
COPY ./frontend/Controller /usr/share/nginx/Controller
COPY ./frontend/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
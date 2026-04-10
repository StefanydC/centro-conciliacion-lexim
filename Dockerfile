FROM nginx:alpine

COPY ./Frontend/View /usr/share/nginx/html
COPY ./Frontend/Controller /usr/share/nginx/Controller
COPY ./Backend/nginx/nginx.conf /etc/nginx/conf.d/default.conf
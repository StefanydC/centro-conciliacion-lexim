FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/View /usr/share/nginx/html
COPY frontend/Controller /usr/share/nginx/Controller

EXPOSE 80

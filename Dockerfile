FROM nginx:alpine
# html y paginas
COPY ./Frontend/View /usr/share/nginx/html
#css, js, imagenes, etc
COPY ./Frontend/Controller /usr/share/nginx/Controller
#configuracion de nginx
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
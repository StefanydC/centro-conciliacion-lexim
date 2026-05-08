FROM nginx:alpine
COPY Frontend/nginx/nginx.conf /etc/nginx/conf.d/default.conf.template
COPY Frontend/pages/ /usr/share/nginx/html/api/
COPY Frontend/assets/ /usr/share/nginx/assets/
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

FROM nginx:alpine
COPY Frontend/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY Frontend/pages/ /usr/share/nginx/html/api/
COPY Frontend/assets/ /usr/share/nginx/assets/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

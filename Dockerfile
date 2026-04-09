FROM nginx:alpine

# Copia frontend
COPY ./visual-virtual/Frontend /usr/share/nginx/html

# Copia config nginx
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
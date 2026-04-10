FROM nginx:alpine

COPY ./visual-virtual/Frontend/View /usr/share/nginx/html
COPY ./visual-virtual/Frontend/Controller /usr/share/nginx/Controller
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
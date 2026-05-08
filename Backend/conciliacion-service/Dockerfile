# ARCHIVO: Backend/conciliacion-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/conciliacion-service/package*.json ./
RUN npm install --omit=dev

COPY Backend/conciliacion-service/ .

EXPOSE 3002

CMD ["node", "src/server.js"]

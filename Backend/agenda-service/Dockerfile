# ARCHIVO: Backend/agenda-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/agenda-service/package*.json ./
RUN npm install --omit=dev

COPY Backend/agenda-service/ .

EXPOSE 3003

CMD ["node", "src/server.js"]

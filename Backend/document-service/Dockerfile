# ARCHIVO: Backend/document-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/document-service/package*.json ./
RUN npm install --omit=dev

COPY Backend/document-service/ .

RUN mkdir -p /app/credentials

EXPOSE 3004

CMD ["node", "src/server.js"]

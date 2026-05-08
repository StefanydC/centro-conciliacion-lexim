# ARCHIVO: Backend/finance-service/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/finance-service/package*.json ./
RUN npm install --omit=dev

COPY Backend/finance-service/ .

EXPOSE 3005

CMD ["node", "src/server.js"]

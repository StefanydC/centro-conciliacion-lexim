# ARCHIVO: Backend/gateway/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY Backend/gateway/package*.json ./
RUN npm install --omit=dev

COPY Backend/gateway/ .

EXPOSE 5000

CMD ["node", "index.js"]

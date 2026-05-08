# ARCHIVO: Backend/gateway/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY Backend/Gateway/package*.json ./
RUN npm install --omit=dev
COPY Backend/Gateway/ .
EXPOSE 5000
CMD ["node", "index.js"]

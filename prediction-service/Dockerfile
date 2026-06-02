FROM node:23-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

ENV DB_PATH=/app/data/prediction.db
RUN mkdir -p /app/data

EXPOSE 3002
CMD ["node", "src/index.js"]

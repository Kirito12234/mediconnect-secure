FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

RUN mkdir -p uploads

EXPOSE 5001

CMD ["node", "server.js"]

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY frontend ./frontend
COPY output ./output
COPY player_data/minimaps ./player_data/minimaps
COPY server.js ./

RUN cd frontend && npm install && npm run build

EXPOSE 10000

CMD ["node", "server.js"]

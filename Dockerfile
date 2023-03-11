FROM node:lts-alpine
ENV TZ=Europe/Zurich

RUN apk add tzdata
RUN npm install rimraf typescript ts-node nodemon @types/node

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm run build

COPY ./build .

CMD [ "node", "index.js" ]
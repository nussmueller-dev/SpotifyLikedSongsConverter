FROM node:lts-alpine
ENV TZ=Europe/Zurich

RUN apk add tzdata

WORKDIR /usr/src/app

RUN npm install --save rimraf typescript ts-node nodemon @types/node

COPY package*.json ./

RUN npm run build

COPY ./build .

CMD [ "node", "index.js" ]
FROM node:lts-alpine
ENV TZ=Europe/Zurich

RUN apk add tzdata
RUN npm install --global rimraf && npm install --global typescript 

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm run build

COPY ./build .

CMD [ "node", "index.js" ]
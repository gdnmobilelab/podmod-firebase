FROM mhart/alpine-node:8

ADD lib lib
ADD migrations migrations
ADD package.json package.json

RUN npm install --production --no-optional
RUN echo "" > .env

EXPOSE 3000

CMD npm run start
FROM mhart/alpine-node:6

ADD lib lib
ADD migrations migrations
ADD package.json package.json

RUN npm install
RUN echo "" > .env

EXPOSE 3000

CMD npm run production-start
FROM alpine:3.6

VOLUME /code

RUN apk add --no-cache postgresql nodejs bash nodejs-npm

RUN mkdir /db
RUN chown -R postgres /db
RUN mkdir /run/postgresql
RUN chown -R postgres /run/postgresql

ENV FIREBASE_AUTH_KEY AUTH_KEY
ENV FIREBASE_SENDER_ID SENDER_ID
ENV DATABASE_URL postgres://postgres@127.0.0.1:5432/postgres
ENV USER_API_KEY TEST_USER_KEY
ENV ADMIN_API_KEY TEST_ADMIN_KEY
ENV FIREBASE_PRIVATE_KEY TEST_PRIVATE_KEY

USER postgres

RUN pg_ctl init -D /db

CMD /code/test/run-tests.sh
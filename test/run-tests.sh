postgres -D /db &
cd /code
npm run migrate
clear

if [[ -z "${TEST_WATCH}" ]]; then
  EXTRA_TEST_COMMANDS=" --watch --watch-extensions ts"
fi
ls /code
NODE_ENV=test node_modules/.bin/mocha --require ts-node/register \"/code/test/**/*.ts\" $TEST_WATCH
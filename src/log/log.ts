import * as bunyan from 'bunyan';
import * as pg from 'pg';
import * as stream from 'stream';
import {DbStream} from './db-stream';
import {SlackWebhook} from './slack-webhook';

const log = bunyan.createLogger({
    name: "pushkin-firebase"
});

let dbStream = new DbStream();

log.addStream({
    level: 'debug',
    stream: dbStream,
    type: 'raw'
});

if (process.env.SLACK_WEBHOOK) {
    log.addStream({
        level: 'warn',
        stream: new SlackWebhook(process.env.SLACK_WEBHOOK, dbStream),
        type: 'raw'
    })
}

export default log;
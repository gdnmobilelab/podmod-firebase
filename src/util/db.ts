import * as pg from 'pg';

export const client = new pg.Client(process.env.DATABASE_URL);

export function query(text:string, params:any[]): Promise<any[]> {
    return new Promise((fulfill, reject) => {
        client.query(text, params, function(err, result) {
            if (err) {
                return reject(err);
            }
            fulfill(result.rows);
        })
    })
}
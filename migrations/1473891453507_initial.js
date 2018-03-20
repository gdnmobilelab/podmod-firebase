exports.up = function(pgm) {
  pgm.createTable("log_entries", {
    id: { type: "serial", primaryKey: true },
    name: { type: "varchar", notNull: true },
    pid: { type: "int8", notNull: true },
    hostname: { type: "varchar", notNull: true },
    time: { type: "timestamp", notNull: true },
    level: { type: "int", notNull: true },
    msg: { type: "varchar", notNull: true },
    v: { type: "int", notNull: true },
    req_id: { type: "varchar" },
    data: { type: "jsonb" }
  });

  pgm.sql(`
    CREATE OR REPLACE FUNCTION jsonb_merge_state(jsonb, jsonb)
    returns jsonb
    language sql
    as $$
        SELECT $1 || $2
    $$;

    DROP AGGREGATE IF EXISTS jsonb_merge(jsonb);

    CREATE AGGREGATE jsonb_merge(jsonb) (
        SFUNC = jsonb_merge_state,
        STYPE = jsonb,
        INITCOND = '{}'
    )
  `);

  pgm.sql(`
    CREATE VIEW log_entries_grouped AS  SELECT min(log_entries."time") AS "time",
        max(log_entries.level) AS level,
        jsonb_merge(log_entries.data) AS data,
        json_agg(log_entries.msg) AS msg,
        log_entries.req_id
    FROM log_entries
    GROUP BY log_entries.req_id;
  `);
};

exports.down = function(pgm) {};

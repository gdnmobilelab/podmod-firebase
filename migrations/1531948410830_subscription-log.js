exports.shorthands = undefined;

// exported so that we can test it
exports.portIntoLogsQuery = `
  INSERT INTO subscription_log (firebase_id, topic_id, action, time)
  SELECT
    g.data->>'id',
    g.data->>'topic',
    g.data->>'action',
    g.time
  FROM log_entries_grouped AS g
  WHERE g.data->>'action' IN ('subscribe', 'unsubscribe');
`;

exports.portIntoCurrentSubscribersQuery = `
  INSERT INTO currently_subscribed (firebase_id,topic_id,subscribe_time)
  SELECT
    firebase_id, topic_id, MAX(time)
  FROM subscription_log as s
  WHERE action = 'subscribe'
  AND (
    SELECT COUNT(*) from subscription_log as s2
    WHERE s2.firebase_id = s.firebase_id
    AND s2.topic_id = s.topic_id
    AND s2.action = 'unsubscribe'
    AND s2.time > s.time
  ) = 0
  GROUP BY firebase_id, topic_id;
`;

exports.up = pgm => {
  pgm.createTable("subscription_log", {
    firebase_id: { type: "varchar", primaryKey: true },
    topic_id: { type: "varchar", primaryKey: true },
    action: { type: "varchar", notNull: true, primaryKey: true },
    time: { type: "timestamp", notNull: true, primaryKey: true }
  });

  pgm.sql(exports.portIntoLogsQuery);
  pgm.sql(exports.portIntoCurrentSubscribersQuery);

  pgm.createTrigger(
    "currently_subscribed",
    "add_insert_to_log",
    {
      when: "AFTER",
      operation: "INSERT",
      level: "ROW",
      language: "plpgsql"
    },
    `
    BEGIN
      INSERT INTO subscription_log
        (firebase_id, topic_id, action,time)
      VALUES
        (NEW.firebase_id, NEW.topic_id, 'subscribe', now());
      RETURN NEW;
    END
  `
  );
  pgm.createTrigger(
    "currently_subscribed",
    "add_delete_to_log",
    {
      when: "AFTER",
      operation: "DELETE",
      level: "ROW",
      language: "plpgsql"
    },
    `
    BEGIN
      INSERT INTO subscription_log
        (firebase_id, topic_id, action,time)
      VALUES
        (OLD.firebase_id, OLD.topic_id, 'unsubscribe', now());
      RETURN OLD;
    END
  `
  );
};

exports.down = pgm => {
  pgm.dropTrigger("currently_subscribed", "add_delete_to_log");
  pgm.dropTrigger("currently_subscribed", "add_insert_to_log");
  pgm.dropTable("subscription_log");
};

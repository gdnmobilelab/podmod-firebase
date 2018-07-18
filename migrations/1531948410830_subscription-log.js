exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable("subscription_log", {
    firebase_id: { type: "varchar", primaryKey: true },
    topic_id: { type: "varchar", primaryKey: true },
    action: { type: "varchar", notNull: true, primaryKey: true },
    time: { type: "timestamp", notNull: true, primaryKey: true }
  });
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

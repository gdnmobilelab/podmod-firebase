exports.shorthands = undefined;

exports.up = pgm => {
  pgm.createTable("currently_subscribed", {
    firebase_id: { type: "varchar", primaryKey: true },
    topic_id: { type: "varchar", primaryKey: true },
    subscribe_time: { type: "timestamp", notNull: true, default: pgm.func("current_timestamp") }
  });
  pgm.createIndex("currently_subscribed", "topic_id");
};

exports.down = pgm => {
  pgm.dropTable("currently_subscribed");
};

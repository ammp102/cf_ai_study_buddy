DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
                          id TEXT PRIMARY KEY,
                          title TEXT NOT NULL,
                          created_at INTEGER NOT NULL
);
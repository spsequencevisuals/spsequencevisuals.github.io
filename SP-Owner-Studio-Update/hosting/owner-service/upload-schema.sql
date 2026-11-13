CREATE TABLE IF NOT EXISTS upload_sessions(id TEXT PRIMARY KEY,storage_key TEXT NOT NULL,upload_id TEXT NOT NULL,filename TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,owner_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS upload_parts(session_id TEXT NOT NULL,part_number INTEGER NOT NULL,etag TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(session_id,part_number));


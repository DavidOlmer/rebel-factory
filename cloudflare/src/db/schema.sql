{
  "code": "CREATE TABLE users (\n" +
    "  id TEXT PRIMARY KEY,\n" +
    "  email TEXT NOT NULL UNIQUE,\n" +
    "  password_hash TEXT NOT NULL,\n" +
    "  name TEXT,\n" +
    "  created_at TEXT DEFAULT (datetime(\"now\")),\n" +
    "  updated_at TEXT DEFAULT (datetime(\"now\"))\n" +
    ");\n" +
    "\n" +
    "CREATE INDEX idx_users_email ON users(email);\n" +
    "\n" +
    "CREATE TABLE ventures (\n" +
    "  id TEXT PRIMARY KEY,\n" +
    "  name TEXT NOT NULL,\n" +
    "  description TEXT,\n" +
    "  created_at TEXT DEFAULT (datetime(\"now\")),\n" +
    "  updated_at TEXT DEFAULT (datetime(\"now\"))\n" +
    ");\n" +
    "\n" +
    "CREATE TABLE agents (\n" +
    "  id TEXT PRIMARY KEY,\n" +
    "  name TEXT NOT NULL,\n" +
    "  description TEXT,\n" +
    "  venture_id TEXT NOT NULL,\n"
# Database Schema & Migration Guide

## Current Schema

### Existing Tables

```sql
-- Current memories table
CREATE TABLE memories (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    metadata TEXT, -- JSON string
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Current activities table (if exists)
CREATE TABLE activities (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT, -- JSON string
    created_at TEXT NOT NULL
);
```

## Target Schema

### New Authentication Tables

```sql
-- Users table (using UUID as TEXT to match existing memories table)
CREATE TABLE users (
    id TEXT PRIMARY KEY, -- UUID as TEXT, consistent with current memories user_id
    github_id TEXT UNIQUE NOT NULL,
    github_username TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_active BOOLEAN DEFAULT 1
);

-- Authentication tokens
CREATE TABLE auth_tokens (
    id TEXT PRIMARY KEY, -- UUID as TEXT for consistency
    user_id TEXT NOT NULL, -- UUID reference to users.id
    token_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default Token',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX idx_auth_tokens_expires ON auth_tokens(expires_at);
```

### Updated Core Tables

```sql
-- Updated memories table with user association (minimal changes to existing structure)
CREATE TABLE memories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, -- UUID as TEXT, matches current implementation
    content TEXT NOT NULL,
    metadata TEXT, -- JSON string
    document_type TEXT DEFAULT 'Memory',
    project_name TEXT,
    tags TEXT, -- JSON array
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_memories_user_id ON memories_new(user_id);
CREATE INDEX idx_memories_created_at ON memories_new(created_at);
CREATE INDEX idx_memories_document_type ON memories_new(document_type);
CREATE INDEX idx_memories_project_name ON memories_new(project_name);
```

### Security & Audit Tables

```sql
-- Security event logging
CREATE TABLE security_logs (
    id TEXT PRIMARY KEY, -- UUID as TEXT for consistency
    type TEXT NOT NULL, -- 'auth_success', 'auth_failure', 'token_generated', etc.
    user_id TEXT, -- UUID reference, nullable for system events
    ip TEXT NOT NULL,
    user_agent TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT, -- JSON string for additional context
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Create indexes for security monitoring
CREATE INDEX idx_security_logs_type ON security_logs(type);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_timestamp ON security_logs(timestamp);
```

### User Settings Table

```sql
-- User preferences and settings
CREATE TABLE user_settings (
    id TEXT PRIMARY KEY, -- UUID as TEXT for consistency
    user_id TEXT UNIQUE NOT NULL, -- UUID reference to users.id
    theme TEXT DEFAULT 'light',
    timezone TEXT DEFAULT 'UTC',
    email_notifications BOOLEAN DEFAULT 1,
    api_rate_limit INTEGER DEFAULT 100, -- requests per minute
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## Migration Strategy

### Phase 1: Schema Setup

```sql
-- migration_001_create_users.sql
BEGIN TRANSACTION;

-- Create users table (UUID as TEXT to match existing memories.user_id)
CREATE TABLE users (
    id TEXT PRIMARY KEY, -- UUID as TEXT, no changes needed to existing code
    github_id TEXT UNIQUE NOT NULL,
    github_username TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_active BOOLEAN DEFAULT 1
);

-- Create auth_tokens table
CREATE TABLE auth_tokens (
    id TEXT PRIMARY KEY, -- UUID as TEXT for consistency
    user_id TEXT NOT NULL, -- UUID reference to users.id
    token_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default Token',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX idx_auth_tokens_expires ON auth_tokens(expires_at);

-- Create security_logs table
CREATE TABLE security_logs (
    id TEXT PRIMARY KEY, -- UUID as TEXT for consistency
    type TEXT NOT NULL,
    user_id TEXT, -- UUID reference, nullable for system events
    ip TEXT NOT NULL,
    user_agent TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_security_logs_type ON security_logs(type);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_timestamp ON security_logs(timestamp);

-- Create user_settings table
CREATE TABLE user_settings (
    id TEXT PRIMARY KEY, -- UUID as TEXT for consistency
    user_id TEXT UNIQUE NOT NULL, -- UUID reference to users.id
    theme TEXT DEFAULT 'light',
    timezone TEXT DEFAULT 'UTC',
    email_notifications BOOLEAN DEFAULT 1,
    api_rate_limit INTEGER DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

COMMIT;
```

### Phase 2: Data Migration

```sql
-- migration_002_migrate_memories.sql
BEGIN TRANSACTION;

-- Add user_id column to existing memories table (if not already UUID)
-- Note: If memories table already has user_id as UUID TEXT, skip this step
ALTER TABLE memories ADD COLUMN user_id TEXT;

-- Create a migration user for existing memories
INSERT OR IGNORE INTO users (id, github_id, github_username, email, name)
VALUES ('migration-uuid', 'migration', 'migration-user', 'migration@context-library.dev', 'Migration User');

-- Get the migration user ID
-- This will be handled in application code to get the actual ID

-- Create new memories table with proper structure
CREATE TABLE memories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, -- UUID as TEXT, matching existing implementation
    content TEXT NOT NULL,
    metadata TEXT,
    document_type TEXT DEFAULT 'Memory',
    project_name TEXT,
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Copy data from old table to new table
INSERT INTO memories_new (id, user_id, content, metadata, created_at, updated_at)
SELECT
    id,
    COALESCE(user_id, 'migration-uuid') as user_id, -- Use existing user_id or migration UUID
    content,
    metadata,
    created_at,
    updated_at
FROM memories;

-- Create indexes
CREATE INDEX idx_memories_user_id ON memories_new(user_id);
CREATE INDEX idx_memories_created_at ON memories_new(created_at);
CREATE INDEX idx_memories_document_type ON memories_new(document_type);
CREATE INDEX idx_memories_project_name ON memories_new(project_name);

-- Rename tables
DROP TABLE memories;
ALTER TABLE memories_new RENAME TO memories;

COMMIT;
```

### Phase 3: Cleanup Migration

```sql
-- migration_003_cleanup.sql
-- This migration can be run after the 30-day migration period

BEGIN TRANSACTION;

-- Remove migration user if no longer needed
-- DELETE FROM users WHERE github_id = 'migration';

-- Add any additional constraints or optimizations
-- ALTER TABLE memories ADD CONSTRAINT chk_content_length CHECK (length(content) > 0);

COMMIT;
```

## Migration Implementation

### Migration Runner

```typescript
interface Migration {
    id: string;
    description: string;
    sql: string;
    rollbackSql?: string;
}

class MigrationRunner {
    constructor(private db: D1Database) {}

    async runMigrations(migrations: Migration[]): Promise<void> {
        // Create migrations table if it doesn't exist
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                executed_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);

        for (const migration of migrations) {
            const exists = await this.db.prepare(
                'SELECT id FROM migrations WHERE id = ?'
            ).bind(migration.id).first();

            if (!exists) {
                console.log(`Running migration: ${migration.id}`);

                try {
                    await this.db.exec(migration.sql);

                    await this.db.prepare(
                        'INSERT INTO migrations (id, description) VALUES (?, ?)'
                    ).bind(migration.id, migration.description).run();

                    console.log(`Migration completed: ${migration.id}`);
                } catch (error) {
                    console.error(`Migration failed: ${migration.id}`, error);
                    throw error;
                }
            }
        }
    }
}
```

### Data Migration Utilities

```typescript
class DataMigration {
    constructor(private db: D1Database) {}

    async migrateLegacyMemories(): Promise<void> {
        // Create migration user
        const migrationUser = await this.db.prepare(`
            INSERT OR IGNORE INTO users (github_id, github_username, email, name)
            VALUES ('migration', 'migration-user', 'migration@context-library.dev', 'Migration User')
            RETURNING id
        `).first();

        if (!migrationUser) {
            // Get existing migration user
            const existingUser = await this.db.prepare(
                'SELECT id FROM users WHERE github_id = ?'
            ).bind('migration').first();

            if (!existingUser) {
                throw new Error('Failed to create or find migration user');
            }
        }

        console.log('Legacy memories migration completed');
    }

    async generateMigrationReport(): Promise<object> {
        const stats = await this.db.prepare(`
            SELECT
                COUNT(*) as total_memories,
                COUNT(DISTINCT user_id) as total_users,
                MIN(created_at) as oldest_memory,
                MAX(created_at) as newest_memory
            FROM memories
        `).first();

        const userStats = await this.db.prepare(`
            SELECT
                u.github_username,
                COUNT(m.id) as memory_count
            FROM users u
            LEFT JOIN memories m ON u.id = m.user_id
            GROUP BY u.id, u.github_username
            ORDER BY memory_count DESC
        `).all();

        return {
            overview: stats,
            userBreakdown: userStats.results,
            migrationDate: new Date().toISOString()
        };
    }
}
```

## Performance Considerations

### Indexing Strategy

```sql
-- Primary performance indexes
CREATE INDEX idx_memories_user_created ON memories(user_id, created_at DESC);
CREATE INDEX idx_memories_user_type ON memories(user_id, document_type);
CREATE INDEX idx_memories_user_project ON memories(user_id, project_name) WHERE project_name IS NOT NULL;

-- Security monitoring indexes
CREATE INDEX idx_security_logs_user_time ON security_logs(user_id, timestamp DESC);
CREATE INDEX idx_security_logs_type_time ON security_logs(type, timestamp DESC);

-- Token management indexes
CREATE INDEX idx_tokens_user_active ON auth_tokens(user_id, is_active, expires_at);
```

### Query Optimization

```typescript
// Optimized memory retrieval with pagination
async function getUserMemories(
    db: D1Database,
    userId: string,
    limit: number = 50,
    offset: number = 0,
    documentType?: string
): Promise<any> {
    let query = `
        SELECT id, content, metadata, document_type, project_name, tags, created_at, updated_at
        FROM memories
        WHERE user_id = ?
    `;

    const params = [userId];

    if (documentType) {
        query += ' AND document_type = ?';
        params.push(documentType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await db.prepare(query).bind(...params).all();
}
```

## Backup & Recovery

### Backup Strategy

```typescript
async function createBackup(db: D1Database, userId: string): Promise<object> {
    const userData = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    const memories = await db.prepare('SELECT * FROM memories WHERE user_id = ?').bind(userId).all();
    const tokens = await db.prepare(
        'SELECT id, name, created_at, expires_at FROM auth_tokens WHERE user_id = ?'
    ).bind(userId).all();

    return {
        version: '1.0',
        exportDate: new Date().toISOString(),
        user: userData,
        memories: memories.results,
        tokens: tokens.results
    };
}
```

### Data Recovery

```typescript
async function restoreUserData(db: D1Database, backupData: any): Promise<void> {
    const transaction = db.batch([
        db.prepare(`
            INSERT OR REPLACE INTO users
            (id, github_id, github_username, email, avatar_url, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...Object.values(backupData.user)),

        ...backupData.memories.map((memory: any) =>
            db.prepare(`
                INSERT OR REPLACE INTO memories
                (id, user_id, content, metadata, document_type, project_name, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(...Object.values(memory))
        )
    ]);

    await transaction;
}
```
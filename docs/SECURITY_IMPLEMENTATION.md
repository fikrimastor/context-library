# Security Implementation Guide

## OAuth 2.0 Flow Implementation

### GitHub OAuth App Configuration

**Application Settings**
```yaml
Application Name: Context-Library MCP
Homepage URL: https://context-library.dev
Authorization Callback URL: https://auth.context-library.dev/callback
```

**Required Scopes**
- `read:user` - Access to public user profile information

### OAuth Flow Implementation

```typescript
// OAuth initiation
app.get('/auth/github', async (c) => {
    const state = crypto.randomUUID();
    await c.env.KV.put(`oauth_state_${state}`, '1', { expirationTtl: 600 });

    const authUrl = new URL('https://github.com/oauth/authorize');
    authUrl.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', c.env.GITHUB_CALLBACK_URL);
    authUrl.searchParams.set('scope', 'read:user');
    authUrl.searchParams.set('state', state);

    return c.redirect(authUrl.toString());
});

// OAuth callback handler
app.get('/auth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');

    // Validate state parameter
    const storedState = await c.env.KV.get(`oauth_state_${state}`);
    if (!storedState) {
        return c.json({ error: 'Invalid state parameter' }, 400);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/oauth/access_token', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: c.env.GITHUB_CLIENT_ID,
            client_secret: c.env.GITHUB_CLIENT_SECRET,
            code: code,
        }),
    });

    const tokenData = await tokenResponse.json();

    // Fetch user information
    const userResponse = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
        },
    });

    const userData = await userResponse.json();

    // Create or update user record
    await createOrUpdateUser(c.env.DB, userData);

    // Generate bearer token
    const bearerToken = await generateBearerToken(c.env.DB, userData.id);

    // Redirect to dashboard with token
    return c.redirect(`${c.env.DASHBOARD_URL}/auth-success?token=${bearerToken}`);
});
```

## Bearer Token System

### Token Generation

```typescript
interface TokenConfig {
    entropy: number;        // 256 bits
    prefix: string;         // 'ctx_'
    encoding: string;       // 'base64url'
    expiry: number;         // 90 days
}

async function generateBearerToken(db: D1Database, userId: string, name?: string): Promise<string> {
    // Generate cryptographically secure random bytes
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
    const tokenString = btoa(String.fromCharCode(...tokenBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    const bearerToken = `ctx_${tokenString}`;
    const tokenHash = await sha256(bearerToken);

    // Store hashed token in database
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    await db.prepare(`
        INSERT INTO auth_tokens (user_id, token_hash, name, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).bind(userId, tokenHash, name || 'Default Token', new Date().toISOString(), expiresAt).run();

    return bearerToken;
}

async function sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Token Validation Middleware

```typescript
interface AuthenticatedContext extends Context {
    user: {
        id: string;
        githubId: string;
        username: string;
        tokenId: string;
    };
}

const authMiddleware = async (c: Context, next: Next): Promise<Response | void> => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7);

    if (!token.startsWith('ctx_')) {
        return c.json({ error: 'Invalid token format' }, 401);
    }

    try {
        const tokenHash = await sha256(token);

        // Query token with user information
        const result = await c.env.DB.prepare(`
            SELECT
                t.id as token_id,
                t.user_id,
                t.expires_at,
                u.github_id,
                u.github_username
            FROM auth_tokens t
            JOIN users u ON t.user_id = u.id
            WHERE t.token_hash = ? AND t.expires_at > datetime('now')
        `).bind(tokenHash).first();

        if (!result) {
            return c.json({ error: 'Invalid or expired token' }, 401);
        }

        // Update last used timestamp
        await c.env.DB.prepare(`
            UPDATE auth_tokens
            SET last_used_at = datetime('now')
            WHERE id = ?
        `).bind(result.token_id).run();

        // Set user context
        c.set('user', {
            id: result.user_id,
            githubId: result.github_id,
            username: result.github_username,
            tokenId: result.token_id,
        });

        await next();
    } catch (error) {
        console.error('Authentication error:', error);
        return c.json({ error: 'Authentication failed' }, 500);
    }
};
```

## Rate Limiting & Security

### Rate Limiting Implementation

```typescript
const rateLimiter = async (c: Context, next: Next): Promise<Response | void> => {
    const tokenHash = await sha256(c.req.header('Authorization')?.substring(7) || '');
    const key = `rate_limit_${tokenHash}`;
    const window = 60; // 1 minute
    const limit = 100; // requests per minute

    const current = await c.env.KV.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
        return c.json({
            error: 'Rate limit exceeded',
            limit: limit,
            window: window,
            reset: Math.ceil(Date.now() / 1000) + window
        }, 429);
    }

    await c.env.KV.put(key, (count + 1).toString(), { expirationTtl: window });

    // Set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', (limit - count - 1).toString());
    c.header('X-RateLimit-Reset', (Math.ceil(Date.now() / 1000) + window).toString());

    await next();
};
```

### Security Headers

```typescript
const securityHeaders = async (c: Context, next: Next): Promise<Response | void> => {
    await next();

    // Security headers
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // HSTS for HTTPS
    if (c.req.url.startsWith('https://')) {
        c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
};
```

## CSRF Protection

### State Parameter Validation

```typescript
class CSRFProtection {
    static async generateState(): Promise<string> {
        const state = crypto.randomUUID();
        const timestamp = Date.now().toString();
        return btoa(`${state}:${timestamp}`);
    }

    static async validateState(state: string, maxAge: number = 600000): Promise<boolean> {
        try {
            const decoded = atob(state);
            const [stateValue, timestamp] = decoded.split(':');

            if (!stateValue || !timestamp) return false;

            const age = Date.now() - parseInt(timestamp);
            return age < maxAge;
        } catch {
            return false;
        }
    }
}
```

## Data Protection

### User Data Isolation

```typescript
async function getUserMemories(db: D1Database, userId: string, limit: number = 50) {
    return await db.prepare(`
        SELECT id, content, metadata, created_at, updated_at
        FROM memories
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT ?
    `).bind(userId, limit).all();
}

async function createMemory(db: D1Database, userId: string, content: string, metadata: object) {
    return await db.prepare(`
        INSERT INTO memories (user_id, content, metadata, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).bind(userId, content, JSON.stringify(metadata)).run();
}
```

### Sensitive Data Handling

```typescript
// Never log sensitive information
function sanitizeForLogging(data: any): any {
    const sensitive = ['token', 'password', 'secret', 'key', 'authorization'];

    if (typeof data === 'string') {
        return sensitive.some(s => data.toLowerCase().includes(s)) ? '[REDACTED]' : data;
    }

    if (typeof data === 'object' && data !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(data)) {
            sanitized[key] = sensitive.some(s => key.toLowerCase().includes(s))
                ? '[REDACTED]'
                : sanitizeForLogging(value);
        }
        return sanitized;
    }

    return data;
}
```

## Environment Variables

### Required Secrets

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_app_client_id
GITHUB_CLIENT_SECRET=your_github_app_client_secret
GITHUB_CALLBACK_URL=https://auth.context-library.dev/callback

# Application
DASHBOARD_URL=https://dashboard.context-library.dev
JWT_SECRET=your_256_bit_secret_key

# CloudFlare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

### Secrets Management

```typescript
// Validate required environment variables
function validateEnvironment(env: any): void {
    const required = [
        'GITHUB_CLIENT_ID',
        'GITHUB_CLIENT_SECRET',
        'GITHUB_CALLBACK_URL',
        'DASHBOARD_URL',
        'JWT_SECRET'
    ];

    const missing = required.filter(key => !env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
```

## Audit Logging

### Security Event Logging

```typescript
interface SecurityEvent {
    type: 'auth_success' | 'auth_failure' | 'token_generated' | 'token_revoked' | 'rate_limit_exceeded';
    userId?: string;
    ip: string;
    userAgent: string;
    timestamp: string;
    metadata?: object;
}

async function logSecurityEvent(db: D1Database, event: SecurityEvent): Promise<void> {
    await db.prepare(`
        INSERT INTO security_logs (type, user_id, ip, user_agent, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        event.type,
        event.userId || null,
        event.ip,
        event.userAgent,
        event.timestamp,
        JSON.stringify(event.metadata || {})
    ).run();
}
```

## Incident Response

### Suspicious Activity Detection

```typescript
async function detectSuspiciousActivity(db: D1Database, userId: string): Promise<boolean> {
    // Check for multiple failed authentications
    const failedAttempts = await db.prepare(`
        SELECT COUNT(*) as count
        FROM security_logs
        WHERE user_id = ?
        AND type = 'auth_failure'
        AND timestamp > datetime('now', '-1 hour')
    `).bind(userId).first();

    if (failedAttempts.count > 5) {
        await logSecurityEvent(db, {
            type: 'rate_limit_exceeded',
            userId,
            ip: 'system',
            userAgent: 'system',
            timestamp: new Date().toISOString(),
            metadata: { reason: 'multiple_failed_auth' }
        });
        return true;
    }

    return false;
}
```

### Token Revocation

```typescript
async function revokeToken(db: D1Database, tokenId: string, userId: string): Promise<boolean> {
    const result = await db.prepare(`
        DELETE FROM auth_tokens
        WHERE id = ? AND user_id = ?
    `).bind(tokenId, userId).run();

    if (result.changes > 0) {
        await logSecurityEvent(db, {
            type: 'token_revoked',
            userId,
            ip: 'system',
            userAgent: 'system',
            timestamp: new Date().toISOString(),
            metadata: { tokenId }
        });
        return true;
    }

    return false;
}
```
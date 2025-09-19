# Context-Library GitHub OAuth System Architecture

## Overview

Hybrid authentication system that combines GitHub OAuth with bearer token generation for secure MCP client access while maintaining simple developer UX.

## Current Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Clients   │    │  CloudFlare      │    │   Data Layer    │
│                 │    │  Workers         │    │                 │
│ • Claude.ai     │───▶│                  │───▶│ • D1 Database   │
│ • Cursor        │    │ • Hono.js        │    │ • Vectorize     │
│ • Windsurf      │    │ • Durable Objects│    │ • Workers AI    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Target Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Clients   │    │  Auth Layer      │    │  Core Services  │    │   Data Layer    │
│                 │    │                  │    │                 │    │                 │
│ Bearer Token    │───▶│ • Auth Middleware│───▶│ • MCP Server    │───▶│ • D1 Database   │
│ Authentication  │    │ • Token Validation│    │ • Hono Router   │    │ • Vectorize     │
│                 │    │ • User Context   │    │ • Durable Objects│   │ • Workers AI    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲
                                │
┌─────────────────┐    ┌──────────────────┐
│  Web Dashboard  │    │  GitHub OAuth    │
│                 │    │                  │
│ • CloudFlare    │───▶│ • OAuth App      │
│   Pages         │    │ • Callback       │
│ • Token Mgmt    │    │ • User Profile   │
└─────────────────┘    └──────────────────┘
```

## Component Specifications

### 1. Authentication Layer

**GitHub OAuth Integration**
- Scope: `read:user` (minimal permissions)
- Callback URL: `https://auth.context-library.dev/callback`
- Provider: `@hono/oauth-providers`

**Bearer Token System**
- Generation: 256-bit entropy, cryptographically secure
- Storage: Hashed in D1 database (SHA-256)
- Expiry: 90 days (configurable)
- Format: `ctx_<base64_encoded_token>`

**Authentication Middleware**
```typescript
interface AuthContext {
    userId: string;          // GitHub user ID
    username: string;        // GitHub username
    tokenId: string;         // Internal token reference
    scopes: string[];        // Future: permission scopes
}
```

### 2. Web Dashboard (CloudFlare Pages)

**Features**
- GitHub OAuth login/logout
- Bearer token generation and management
- Token usage analytics
- Account settings

**Technology Stack**
- Framework: React/Vite or Next.js
- Styling: Tailwind CSS
- Hosting: CloudFlare Pages
- Build: GitHub Actions

### 3. Database Schema Extensions

**New Tables**
```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    github_id TEXT UNIQUE NOT NULL,
    github_username TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Authentication tokens
CREATE TABLE auth_tokens (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    name TEXT, -- User-defined token name
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

**Migration Strategy**
```sql
-- Migrate existing memories to user association
ALTER TABLE memories ADD COLUMN user_id INTEGER;
UPDATE memories SET user_id = (
    SELECT id FROM users WHERE github_username = 'migration_user'
) WHERE user_id IS NULL;
```

### 4. API Endpoints

**Authentication Routes**
```
GET  /auth/github              # Initiate OAuth flow
GET  /auth/callback            # OAuth callback handler
POST /auth/tokens              # Generate new bearer token
GET  /auth/tokens              # List user tokens
DEL  /auth/tokens/:id          # Revoke token
```

**Protected MCP Routes**
```
Headers: Authorization: Bearer ctx_<token>

GET  /:userId/memories         # List memories (userId = 'me')
POST /:userId/memories         # Create memory
GET  /:userId/memories/:id     # Get memory
...
```

### 5. Security Considerations

**Token Security**
- Tokens stored as SHA-256 hashes, never plaintext
- Rate limiting: 100 requests/minute per token
- Automatic token rotation notification
- Secure token transmission over HTTPS only

**User Data Protection**
- Minimal GitHub permissions (read:user only)
- User data isolation by GitHub ID
- No sensitive data in logs
- GDPR compliance for EU users

**Attack Mitigation**
- CSRF protection on OAuth flow
- Token binding to IP ranges (optional)
- Suspicious activity detection
- Brute force protection

## Data Flow

### 1. Initial Authentication
```
User → Dashboard → GitHub OAuth → Callback → JWT Generation → Bearer Token
```

### 2. MCP Client Usage
```
MCP Client → Bearer Token → Auth Middleware → User Context → MCP Server → Data Layer
```

### 3. Token Validation
```
Bearer Token → SHA-256 Hash → Database Lookup → User Context → Request Processing
```

## Performance Characteristics

**Expected Load**
- 1,000+ active developers (Phase 2-3)
- 100 requests/minute per user
- 50+ team workspaces
- 95% uptime SLA

**Scaling Strategy**
- CloudFlare's global edge network
- D1 database horizontal scaling
- Vectorize automatic scaling
- Durable Objects for user session state

## Monitoring & Observability

**Metrics**
- Authentication success/failure rates
- Token usage patterns
- API response times
- Error rates by endpoint

**Logging**
- Security events (failed authentications)
- Performance bottlenecks
- User activity patterns (anonymized)
- System health metrics

## Backward Compatibility

**30-Day Migration Period**
- Support both localStorage user_id and bearer tokens
- Gradual migration notifications
- Data export for users who don't migrate
- Automated cleanup after migration period

**Migration Tools**
- User data export utility
- Token generation for existing users
- Dashboard migration wizard
- Support documentation
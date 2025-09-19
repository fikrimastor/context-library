# API Reference Documentation

## Authentication

All API endpoints (except authentication routes) require a Bearer token in the Authorization header.

```
Authorization: Bearer ctx_<your_token_here>
```

## Base URL

```
Production: https://api.context-library.dev
Development: http://localhost:8787
```

## Authentication Endpoints

### Initiate GitHub OAuth

```http
GET /auth/github
```

**Description**: Redirects to GitHub OAuth authorization page.

**Query Parameters**:
- `redirect_uri` (optional): URL to redirect after authentication

**Response**: HTTP 302 redirect to GitHub OAuth

---

### OAuth Callback

```http
GET /auth/callback
```

**Description**: Handles GitHub OAuth callback and generates bearer token.

**Query Parameters**:
- `code`: OAuth authorization code from GitHub
- `state`: CSRF protection state parameter

**Success Response**:
```http
HTTP/1.1 302 Found
Location: https://dashboard.context-library.dev/auth-success?token=ctx_abc123...
```

**Error Response**:
```json
{
    "error": "Invalid state parameter",
    "code": "INVALID_STATE"
}
```

---

### Generate Bearer Token

```http
POST /auth/tokens
```

**Description**: Generate a new bearer token (requires existing valid session).

**Request Body**:
```json
{
    "name": "My Development Token"
}
```

**Success Response**:
```json
{
    "token": "ctx_abc123...",
    "id": "token_456",
    "name": "My Development Token",
    "expiresAt": "2024-03-15T10:30:00Z"
}
```

**Error Responses**:
```json
{
    "error": "Unauthorized",
    "code": "AUTH_REQUIRED"
}
```

---

### List User Tokens

```http
GET /auth/tokens
```

**Description**: List all active tokens for the authenticated user.

**Success Response**:
```json
{
    "tokens": [
        {
            "id": "token_123",
            "name": "Default Token",
            "createdAt": "2024-01-15T10:30:00Z",
            "expiresAt": "2024-04-15T10:30:00Z",
            "lastUsedAt": "2024-01-20T14:22:00Z"
        },
        {
            "id": "token_456",
            "name": "Development Token",
            "createdAt": "2024-01-16T09:15:00Z",
            "expiresAt": "2024-04-16T09:15:00Z",
            "lastUsedAt": null
        }
    ]
}
```

---

### Revoke Token

```http
DELETE /auth/tokens/:tokenId
```

**Description**: Revoke a specific bearer token.

**Path Parameters**:
- `tokenId`: The ID of the token to revoke

**Success Response**:
```json
{
    "success": true,
    "message": "Token revoked successfully"
}
```

**Error Responses**:
```json
{
    "error": "Token not found",
    "code": "TOKEN_NOT_FOUND"
}
```

## Memory Management Endpoints

### List Memories

```http
GET /:userId/memories
```

**Description**: Retrieve user's memories with optional filtering and pagination.

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user, or specific user ID for shared access

**Query Parameters**:
- `limit` (optional, default: 50): Maximum number of memories to return
- `offset` (optional, default: 0): Number of memories to skip for pagination
- `documentType` (optional): Filter by document type ("Memory", "PRD", "TechnicalSpec", etc.)
- `projectName` (optional): Filter by project name
- `tags` (optional): Comma-separated list of tags to filter by
- `search` (optional): Search query for content

**Success Response**:
```json
{
    "memories": [
        {
            "id": "memory_123",
            "content": "User prefers React over Vue for frontend development",
            "metadata": {
                "confidence": 0.95,
                "source": "conversation"
            },
            "documentType": "Memory",
            "projectName": "web-app",
            "tags": ["frontend", "preferences"],
            "createdAt": "2024-01-15T10:30:00Z",
            "updatedAt": "2024-01-15T10:30:00Z"
        }
    ],
    "pagination": {
        "total": 150,
        "limit": 50,
        "offset": 0,
        "hasMore": true
    }
}
```

---

### Get Single Memory

```http
GET /:userId/memories/:memoryId
```

**Description**: Retrieve a specific memory by ID.

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user
- `memoryId`: The ID of the memory to retrieve

**Success Response**:
```json
{
    "id": "memory_123",
    "content": "User prefers React over Vue for frontend development",
    "metadata": {
        "confidence": 0.95,
        "source": "conversation"
    },
    "documentType": "Memory",
    "projectName": "web-app",
    "tags": ["frontend", "preferences"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
```json
{
    "error": "Memory not found",
    "code": "MEMORY_NOT_FOUND"
}
```

---

### Create Memory

```http
POST /:userId/memories
```

**Description**: Create a new memory.

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user

**Request Body**:
```json
{
    "content": "User prefers dark mode for code editors",
    "documentType": "Memory",
    "projectName": "dev-preferences",
    "tags": ["ui", "preferences"],
    "metadata": {
        "source": "conversation",
        "confidence": 0.9
    }
}
```

**Success Response**:
```json
{
    "id": "memory_456",
    "content": "User prefers dark mode for code editors",
    "metadata": {
        "source": "conversation",
        "confidence": 0.9
    },
    "documentType": "Memory",
    "projectName": "dev-preferences",
    "tags": ["ui", "preferences"],
    "createdAt": "2024-01-16T14:22:00Z",
    "updatedAt": "2024-01-16T14:22:00Z"
}
```

---

### Update Memory

```http
PUT /:userId/memories/:memoryId
```

**Description**: Update an existing memory.

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user
- `memoryId`: The ID of the memory to update

**Request Body**:
```json
{
    "content": "User strongly prefers dark mode for all development tools",
    "tags": ["ui", "preferences", "development"],
    "metadata": {
        "confidence": 0.95,
        "lastUpdated": "2024-01-16T14:22:00Z"
    }
}
```

**Success Response**:
```json
{
    "id": "memory_456",
    "content": "User strongly prefers dark mode for all development tools",
    "metadata": {
        "confidence": 0.95,
        "lastUpdated": "2024-01-16T14:22:00Z"
    },
    "documentType": "Memory",
    "projectName": "dev-preferences",
    "tags": ["ui", "preferences", "development"],
    "createdAt": "2024-01-16T14:22:00Z",
    "updatedAt": "2024-01-16T15:10:00Z"
}
```

---

### Delete Memory

```http
DELETE /:userId/memories/:memoryId
```

**Description**: Delete a specific memory.

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user
- `memoryId`: The ID of the memory to delete

**Success Response**:
```json
{
    "success": true,
    "message": "Memory deleted successfully"
}
```

---

### Search Memories

```http
POST /:userId/memories/search
```

**Description**: Perform semantic search across user's memories.

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user

**Request Body**:
```json
{
    "query": "What does the user prefer for frontend development?",
    "limit": 10,
    "threshold": 0.7,
    "filters": {
        "documentType": ["Memory", "PRD"],
        "projectName": "web-app",
        "tags": ["frontend"]
    }
}
```

**Success Response**:
```json
{
    "results": [
        {
            "memory": {
                "id": "memory_123",
                "content": "User prefers React over Vue for frontend development",
                "documentType": "Memory",
                "tags": ["frontend", "preferences"]
            },
            "score": 0.89,
            "relevance": "high"
        },
        {
            "memory": {
                "id": "memory_124",
                "content": "User likes TypeScript for type safety in React projects",
                "documentType": "Memory",
                "tags": ["frontend", "typescript"]
            },
            "score": 0.76,
            "relevance": "medium"
        }
    ],
    "query": "What does the user prefer for frontend development?",
    "totalResults": 2
}
```

---

### Restore Memories

```http
POST /:userId/memories/restore
```

**Description**: Restore missing memories from D1 to Vectorize (admin operation).

**Path Parameters**:
- `userId`: Use `"me"` for authenticated user

**Success Response**:
```json
{
    "restored": 15,
    "skipped": 3,
    "errors": 0,
    "message": "Memory restoration completed successfully"
}
```

## User Profile Endpoints

### Get User Profile

```http
GET /profile
```

**Description**: Get authenticated user's profile information.

**Success Response**:
```json
{
    "id": "user_123",
    "githubId": "12345678",
    "username": "developer123",
    "email": "dev@example.com",
    "name": "John Developer",
    "avatarUrl": "https://avatars.githubusercontent.com/u/12345678",
    "createdAt": "2024-01-15T10:30:00Z",
    "settings": {
        "theme": "dark",
        "timezone": "UTC",
        "emailNotifications": true,
        "apiRateLimit": 100
    }
}
```

---

### Update User Settings

```http
PUT /profile/settings
```

**Description**: Update user's preferences and settings.

**Request Body**:
```json
{
    "theme": "dark",
    "timezone": "America/New_York",
    "emailNotifications": false,
    "apiRateLimit": 150
}
```

**Success Response**:
```json
{
    "settings": {
        "theme": "dark",
        "timezone": "America/New_York",
        "emailNotifications": false,
        "apiRateLimit": 150
    },
    "updatedAt": "2024-01-16T15:30:00Z"
}
```

## Analytics Endpoints

### Get Usage Statistics

```http
GET /analytics/usage
```

**Description**: Get usage statistics for the authenticated user.

**Query Parameters**:
- `period` (optional, default: "30d"): Time period ("7d", "30d", "90d", "1y")

**Success Response**:
```json
{
    "period": "30d",
    "stats": {
        "totalMemories": 150,
        "memoriesCreated": 25,
        "searchQueries": 89,
        "apiRequests": 1250,
        "tokensUsed": 3
    },
    "dailyUsage": [
        {
            "date": "2024-01-15",
            "memories": 3,
            "searches": 8,
            "requests": 45
        }
    ]
}
```

## Error Responses

### Standard Error Format

All error responses follow this format:

```json
{
    "error": "Human-readable error message",
    "code": "MACHINE_READABLE_CODE",
    "details": {
        "field": "Additional context when applicable"
    },
    "timestamp": "2024-01-16T15:30:00Z"
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_REQUEST | Request body or parameters are invalid |
| 401 | AUTH_REQUIRED | Authentication token missing or invalid |
| 401 | TOKEN_EXPIRED | Bearer token has expired |
| 403 | INSUFFICIENT_PERMISSIONS | User lacks permission for this action |
| 404 | MEMORY_NOT_FOUND | Requested memory does not exist |
| 404 | TOKEN_NOT_FOUND | Requested token does not exist |
| 429 | RATE_LIMIT_EXCEEDED | API rate limit exceeded |
| 500 | INTERNAL_ERROR | Server error occurred |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

### Rate Limiting Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642348200
```

## SDK Examples

### JavaScript/TypeScript

```typescript
class ContextLibraryClient {
    constructor(private token: string, private baseUrl: string = 'https://api.context-library.dev') {}

    private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API Error: ${error.error} (${error.code})`);
        }

        return response.json();
    }

    async createMemory(content: string, options: {
        documentType?: string;
        projectName?: string;
        tags?: string[];
        metadata?: object;
    } = {}): Promise<any> {
        return this.request('/me/memories', {
            method: 'POST',
            body: JSON.stringify({ content, ...options }),
        });
    }

    async searchMemories(query: string, options: {
        limit?: number;
        threshold?: number;
        filters?: object;
    } = {}): Promise<any> {
        return this.request('/me/memories/search', {
            method: 'POST',
            body: JSON.stringify({ query, ...options }),
        });
    }

    async getMemories(options: {
        limit?: number;
        offset?: number;
        documentType?: string;
        projectName?: string;
    } = {}): Promise<any> {
        const params = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined) params.append(key, value.toString());
        });

        return this.request(`/me/memories?${params.toString()}`);
    }
}

// Usage
const client = new ContextLibraryClient('ctx_your_token_here');

// Create a memory
await client.createMemory('User prefers React for frontend development', {
    documentType: 'Memory',
    tags: ['frontend', 'preferences']
});

// Search memories
const results = await client.searchMemories('What frontend framework does the user prefer?');
```

### Python

```python
import requests
from typing import Optional, Dict, List, Any

class ContextLibraryClient:
    def __init__(self, token: str, base_url: str = "https://api.context-library.dev"):
        self.token = token
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def _request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Any:
        url = f"{self.base_url}{endpoint}"
        response = requests.request(method, url, headers=self.headers, json=data)

        if not response.ok:
            error = response.json()
            raise Exception(f"API Error: {error['error']} ({error['code']})")

        return response.json()

    def create_memory(self, content: str, document_type: str = "Memory",
                     project_name: Optional[str] = None, tags: Optional[List[str]] = None,
                     metadata: Optional[Dict] = None) -> Dict:
        data = {"content": content, "documentType": document_type}
        if project_name:
            data["projectName"] = project_name
        if tags:
            data["tags"] = tags
        if metadata:
            data["metadata"] = metadata

        return self._request("/me/memories", "POST", data)

    def search_memories(self, query: str, limit: int = 10, threshold: float = 0.7,
                       filters: Optional[Dict] = None) -> Dict:
        data = {"query": query, "limit": limit, "threshold": threshold}
        if filters:
            data["filters"] = filters

        return self._request("/me/memories/search", "POST", data)

# Usage
client = ContextLibraryClient("ctx_your_token_here")

# Create a memory
memory = client.create_memory(
    "User prefers React for frontend development",
    document_type="Memory",
    tags=["frontend", "preferences"]
)

# Search memories
results = client.search_memories("What frontend framework does the user prefer?")
```
# MCP Context Library - Task Completion Guidelines

## When a Task is Completed

### Required Code Quality Checks
Since this project doesn't have automated testing, always run these commands after making code changes:

```bash
# 1. Format code (REQUIRED)
npm run format

# 2. Fix linting issues (REQUIRED)
npm run lint:fix

# 3. Generate updated types if wrangler config changed
npm run cf-typegen
```

### Local Testing
```bash
# 1. Start development server
npm run dev

# 2. Test the application in browser
# Visit: http://localhost:8787
# Test key endpoints:
# - GET / (home page)
# - GET /memories (memories page)
# - POST /:userId/memories (add memory - needs testing tool)

# 3. Check console for errors
# Monitor wrangler dev console output for any runtime errors
```

### Pre-Deployment Verification
```bash
# 1. Ensure no TypeScript errors
# Run: wrangler dev and check for compilation errors

# 2. Verify Cloudflare service bindings
# Check that all required services are configured in wrangler.jsonc:
# - D1 Database: mcp-large-context
# - Vectorize: vectorize-context-library
# - AI binding: AI
# - Assets: ASSETS
# - Durable Objects: MCP_OBJECT
# - Rate Limiter: RATE_LIMITER

# 3. Test with actual MCP client (if applicable)
# Test MCP protocol functionality with Claude, Cursor, or Windsurf
```

## Deployment Process
```bash
# Deploy to production
npm run deploy

# Verify deployment
# Check Cloudflare Workers dashboard
# Test production URL functionality
```

## No Automated Testing Framework
⚠️ **Important**: This project currently has no automated test suite (Jest, Vitest, etc.)

### Manual Testing Required
- Test REST API endpoints manually
- Test MCP protocol functionality with real clients
- Verify Vectorize and D1 operations work correctly
- Check error handling and edge cases

### Recommended Testing Approach
1. **Unit Testing**: Test individual utility functions in `src/utils/`
2. **Integration Testing**: Test MCP protocol communication
3. **End-to-End Testing**: Test with actual AI clients

## Error Handling Verification
- Check console logs during development
- Verify error responses are appropriate
- Test rate limiting behavior
- Validate input sanitization and Zod schemas

## Performance Considerations
- Monitor Cloudflare Workers metrics
- Check D1 database query performance
- Verify Vectorize index performance
- Monitor memory usage in Durable Objects

## Security Checklist
- Verify user isolation (userId-based namespacing)
- Check rate limiting is working
- Validate input sanitization
- Ensure no sensitive data is logged
# MCP Context Library - Code Style & Conventions

## Formatter & Linter (Biome)
- **Tool**: Biome.js for formatting and linting
- **Indentation**: 4 spaces (not tabs)
- **Line Width**: 100 characters maximum
- **Import Organization**: Enabled and automatic

## TypeScript Configuration
- **Target**: ES2021
- **Module**: ES2022 with Bundler resolution
- **Strict Mode**: Enabled
- **JSX**: react-jsx (though not used in this project)
- **JSON Module Resolution**: Enabled
- **Isolated Modules**: True (required for Workers)

## Linting Rules
### Disabled Rules (Allowed)
- `noExplicitAny`: Explicit `any` types allowed
- `noDebugger`: Debugger statements allowed
- `noConsoleLog`: Console.log allowed (common in serverless)
- `noConfusingVoidType`: Confusing void types allowed
- `noNonNullAssertion`: Non-null assertions allowed

### Enabled Rules
- All other recommended Biome rules are enforced

## Naming Conventions
- **Functions/Variables**: camelCase (e.g., `generateEmbeddings`, `storeMemory`)
- **Classes**: PascalCase (e.g., `MyMCP`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MINIMUM_SIMILARITY_SCORE`)
- **File Names**: kebab-case or camelCase (e.g., `vectorize.ts`, `db.ts`)

## Code Organization
### File Structure
```
src/
├── index.ts          # Main Hono application with REST API
├── mcp.ts            # Durable Object MCP Server implementation
└── utils/
    ├── db.ts         # D1 database operations
    └── vectorize.ts  # Vector operations and AI embeddings
```

### Function Organization
- **Async/Await**: All external service calls use async/await
- **Error Handling**: Try-catch blocks with console logging
- **Exports**: Named exports preferred over default exports
- **Type Safety**: Full TypeScript typing with Zod validation

## Comments & Documentation
- **JSDoc**: Not extensively used, code should be self-documenting
- **Inline Comments**: Minimal, focus on complex logic only
- **README**: Comprehensive project documentation maintained

## Git Conventions
- **Branch Strategy**: Feature branches (e.g., `feature/1`)
- **Ignored Files**: Standard TypeScript/Node.js gitignore
- **Generated Files**: `worker-configuration.d.ts` ignored in Biome
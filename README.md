<div align="center" >🤝 Show your support - give a ⭐️ if you liked the content
</div>

---

# MCP Context Library

**MCP Context Library** is a **MCP Server** that gives **MCP Clients (Cursor, Claude, Windsurf and more)** the **ability to remember** information about users (preferences, behaviors) **across conversations**. It uses vector search technology to find relevant memories based on meaning, not just keywords. It's built with Cloudflare Workers, D1, Vectorize (RAG), Durable Objects, Workers AI and Agents.

## 🚀 Try It Out


### [https://memory.mcpgenerator.com/](https://memory.mcpgenerator.com/)



## 🛠️ How to Deploy Your Own MCP Context Library

### Option 1: One-Click Deploy Your Own MCP Context Library to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/fikrimastor/context-library)

In **Create Vectorize** section choose:
- **Dimensions:** 1024
- **Metric:** cosine

Click button **"Create and Deploy"**

In Cloudflare dashboard, go to "Workers & Pages" and click on Visit

![Visit MCP Context Library](/visit.png)


### Option 2: Use this template
1. Click the "Use this template" button at the top of this repository
2. Clone your new repository
3. Follow the setup instructions below

### Option 3: Create with CloudFlare CLI

```bash
npm create cloudflare@latest --git https://github.com/fikrimastor/context-library
```

## 🔧 Setup (Only Option 2 & 3)

1. Install dependencies:
```bash
npm install
```

2. Create a Vectorize index:
```bash
npx wrangler vectorize create vectorize-context-library --dimensions 1024 --metric cosine
```

3. Install Wrangler:
```bash
npm run dev
```

4. Deploy the worker:
```bash
npm run deploy
```

## ✨ Enhanced Features

### 🔄 Memory Restoration
- **Automatic Sync**: Restore missing memories from D1 database to Vectorize index
- **Data Integrity**: Ensures consistency between persistent storage and vector search
- **Recovery Tools**: Built-in restoration functionality for missing vector embeddings

### 🔍 Advanced Search & Filtering
- **Metadata Filtering**: Enhanced search with metadata filters for targeted memory retrieval
- **Improved Query Handling**: Better query processing and result ranking
- **Type-based Filtering**: Support for filtering memories by type (e.g., memory, journal)

### 📊 Recent Activities
- **Activity Feed**: Retrieve recent activities across different data types
- **Unified Interface**: Combined view of memories and journals with timestamps
- **Configurable Limits**: Customizable activity retrieval limits

### ⚙️ Environment Configuration
- **Dynamic Naming**: Server name configurable via `MCP_NAME` environment variable
- **Flexible Deployment**: Easy rebranding and customization for different deployments

## 🧠 How It Works

![MCP Context Library Architecture](/arch.png)


1. **Storing Memories**:
   - Your text is processed by **Cloudflare Workers AI** using the open-source `@cf/baai/bge-m3` model to generate embeddings
   - The text and its vector embedding are stored in two places:
     - **Cloudflare Vectorize**: Stores the vector embeddings for similarity search
     - **Cloudflare D1**: Stores the original text and metadata for persistence
   - A **Durable Object** (MyMCP) manages the state and ensures consistency
   - The **Agents** framework handles the **MCP protocol** communication

2. **Retrieving Memories**:
   - Your query is converted to a vector using **Workers AI** with the same `@cf/baai/bge-m3` model
   - Vectorize performs similarity search to find relevant memories
   - Results are ranked by similarity score
   - The **D1 database** provides the original text for matched vectors
   - The **Durable Object** coordinates the retrieval process

This architecture enables:
- Fast vector similarity search through Vectorize
- Persistent storage with D1
- Stateful operations via Durable Objects
- Standardized AI interactions through Workers AI
- Protocol compliance via the Agents framework

The system finds conceptually related information even when the exact words don't match.

## 🛠️ Available MCP Tools

The MCP Context Library provides the following tools that AI clients can use:

### Core Memory Tools
- **`add_to_memory`** - Store important user information, preferences, and context for future sessions
- **`search_memory`** - Retrieve relevant memories using semantic search across stored information

### Advanced Document Management
- **`remember_artifact`** - Store complex documents (PRDs, technical specs, journals) with intelligent parsing
  - Automatically detects document types (PRD, TechnicalSpec, FeatureRequest, Documentation, Journal)
  - Breaks large documents into searchable sections with metadata
  - Supports project association, priority levels, and custom tagging

### Document Discovery & Reconstruction
- **`search_artifacts`** - Advanced search with filtering by document type, project, tags, and priority
- **`reconstruct_artifact`** - Reassemble complete documents from stored sections
- **`list_artifacts_by_project`** - Browse all documents associated with a specific project

### Key Features
- **Intelligent Parsing**: Automatically breaks down large documents into logical sections
- **Rich Metadata**: Documents stored with project names, types, priorities, tags, and timestamps
- **Semantic Search**: Find documents by content meaning, not just keywords
- **Project Organization**: Group and filter artifacts by project association

## 🔒 Security

MCP Context Library implements several security measures to protect user data:

- Each user's memories are stored in **isolated namespaces** within Vectorize for data separation
- Built-in **rate limiting** prevents abuse (**100 req/min** - you can change it in wrangler.jsonc)
- **Authentication is based on userId only**
  - While this is sufficient for basic protection due to rate limiting
  - Additional authentication layers (like API keys or OAuth) can be easily added if needed
- All data is stored in Cloudflare's secure infrastructure
- All communications are secured with industry-standard TLS encryption (automatically provided by Cloudflare's SSL/TLS certification)



## 💰 Cost Information - FREE for Most Users

MCP Context Library is free to use for normal usage levels:
- Free tier allows 1,000 memories with ~28,000 queries per month
- Uses Cloudflare's free quota for Workers, Vectorize, Worker AI and D1 database

For more details on Cloudflare pricing, see:
- [Vectorize Pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/pricing-and-rate-limits/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Database D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

## ❓ FAQ

1. **Can I use memory.mcpgenerator.com to store my memories?**
   - Yes, you can use memory.mcpgenerator.com to store and retrieve your memories
   - The service is free
   - Your memories are securely stored and accessible only to you
   - I cannot guarantee that the service will always be available

2. **Can I host it?**
   - Yes, you can host your own instance of MCP Context Library **for free on Cloudflare**
   - You'll need a Cloudflare account and the following services:
     - Workers
     - Vectorize
     - D1 Database
     - Workers AI

3. **Can I run it locally?**
   - Yes, you can run MCP Context Library locally for development
   - Use `wrangler dev` to run the worker locally
   - You'll need to set up local development credentials for Cloudflare services
   - Note that some features like vector search or workers AI requires a connection to Cloudflare's services

4. **Can I use different hosting?**
   - No, MCP Context Library is specifically designed for Cloudflare's infrastructure

5. **Why did you build it?**
   - I wanted an open-source solution
   - Control over my own data was important to me

6. **Can I use it for more than one person?**
   - Yes, MCP Context Library can be integrated into your app to serve all your users
   - Each user gets their own isolated memory space

7. **Can I use it to store things other than memories?**
   - Yes, MCP Context Library can store any type of text-based information
   - Some practical examples:
     - Knowledge Base: Store technical documentation, procedures, and troubleshooting guides
     - User Behaviors: Track how users interact with features and common usage patterns
     - Project Notes: decisions and project updates
   - The vector search will help find related items regardless of content type

# 🤝 Show your support

<div>🤝 Show your support - give a ⭐️ if you liked the content</div>

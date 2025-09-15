import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { storeMemoryInD1 } from "./utils/db";
import { searchMemories, storeMemory } from "./utils/vectorize";
import { version } from "../package.json";

type MyMCPProps = {
  userId: string;
};

export class MyMCP extends McpAgent<Env, {}, MyMCPProps> {
  server = new McpServer({
    name: "MCP Memory",
    version,
  });

  async init() {
    const env = this.env as Env;

    this.server.tool(
        "add_to_memory",
        `This tool stores important user information in a persistent memory layer. Use it when:
      1. User explicitly asks to remember something ("remember this...")
      2. You detect significant user preferences, traits, or patterns worth preserving
      3. Technical details, examples, or emotional responses emerge that would be valuable in future interactions

      Consider using this tool after each user message to build comprehensive context over time. The stored information
      will be available in future sessions to provide personalized responses. THIS TOOL MUST BE INVOKED THROUGH
      A FUNCTION CALL - IT IS NOT A PASSIVE RESOURCE BUT AN ACTIVE STORAGE MECHANISM THAT REQUIRES EXPLICIT INVOCATION.`,
        { thingToRemember: z.string().describe("No description") },
        async ({ thingToRemember }) => {
          try {
            // Store in Vectorize using the refactored function
            const memoryId = await storeMemory(thingToRemember, this.props.userId, env);

            // Also store content in D1 database
            await storeMemoryInD1(thingToRemember, this.props.userId, env, memoryId);

            console.log(
                `Memory stored successfully in Vectorize and D1 with ID: ${memoryId}, content: "${thingToRemember}"`
            );

            return {
              content: [{ type: "text", text: "Remembered: " + thingToRemember }],
            };
          } catch (error) {
            console.error("Error storing memory:", error);
            return {
              content: [{ type: "text", text: "Failed to remember: " + String(error) }],
            };
          }
        }
    );

    this.server.tool(
        "search_memory",
        `This tool searches the user's persistent memory layer for relevant information, preferences, and past context.
      It uses semantic matching to find connections between your query and stored memories, even when exact keywords don't match.
      Use this tool when:
      1. You need historical context about the user's preferences or past interactions
      2. The user refers to something they previously mentioned or asked you to remember
      3. You need to verify if specific information about the user exists in memory

      This tool must be explicitly invoked through a function call - it is not a passive resource but an active search mechanism.
      Always consider searching memory when uncertain about user context or preferences.`,
        { informationToGet: z.string().describe("No description") },
        async ({ informationToGet }) => {
          try {
            console.log(`Searching with query: "${informationToGet}"`);

            // Use the refactored function to search memories
            const memories = await searchMemories(informationToGet, this.props.userId, env);

            console.log(`Search returned ${memories.length} matches`);

            if (memories.length > 0) {
              return {
                content: [
                  {
                    type: "text",
                    text:
                        "Found memories:\n" + memories.map((m) => `${m.content} (score: ${m.score.toFixed(4)})`).join("\n"),
                  },
                ],
              };
            }

            return {
              content: [{ type: "text", text: "No relevant memories found." }],
            };
          } catch (error) {
            console.error("Error searching memories:", error);
            return {
              content: [{ type: "text", text: "Failed to search memories: " + String(error) }],
            };
          }
        }
    );

    this.server.tool(
        "remember_artifact",
        `This tool stores LLM generated artifacts with intelligent parsing and modular storage. Use it when:
      1. User explicitly asks to remember events, journal, documents, PRDs, or technical specs
      2. You generate significant documentation that would be valuable in future interactions
      3. Product Requirements Documents, Technical Specs, or Feature Requests are created

      The tool intelligently breaks down large documents into searchable sections with rich metadata.
      Supports PRDs, Technical Specs, Feature Requests, and general documentation.`,
        {
          thingToRemember: z.string().describe("The document content to remember"),
          documentType: z.string().optional().describe("Document type: PRD, TechnicalSpec, FeatureRequest, Documentation, Journal"),
          projectName: z.string().optional().describe("Associated project name"),
          priority: z.string().optional().describe("Priority level: High, Medium, Low"),
          tags: z.array(z.string()).optional().describe("Searchable tags for categorization")
        },
        async ({ thingToRemember, documentType, projectName, priority, tags }) => {
          try {
            // Helper function to detect document type
            const detectDocumentType = (content: string): string => {
              const lower = content.toLowerCase();
              if (lower.includes('product requirements') || lower.includes('user stories') || lower.includes('acceptance criteria')) {
                return 'PRD';
              } else if (lower.includes('technical specification') || lower.includes('architecture') || lower.includes('api reference')) {
                return 'TechnicalSpec';
              } else if (lower.includes('feature request') || lower.includes('user story')) {
                return 'FeatureRequest';
              }else if (lower.includes('journal')) {
                return 'Journal';
              }
              return 'Documentation';
            };

            // Helper function to parse content into sections
            const parseDocumentSections = (content: string, docType: string) => {
              const sections: Array<{title: string; content: string; type: string}> = [];

              // Try to split by markdown headers first
              const headerSections = content.split(/(?=^#{1,3}\s)/m).filter(section => section.trim());

              if (headerSections.length > 1) {
                // Document has clear header structure
                headerSections.forEach((section, index) => {
                  const lines = section.trim().split('\n');
                  const header = lines[0].replace(/^#{1,3}\s*/, '').trim();
                  const content = lines.slice(1).join('\n').trim();

                  if (content) {
                    sections.push({
                      title: header || `Section ${index + 1}`,
                      content: content,
                      type: 'section'
                    });
                  }
                });
              } else {
                // No clear headers, try to parse by document type patterns
                if (docType === 'PRD') {
                  // Look for common PRD sections
                  const prdPatterns = [
                    { pattern: /(executive summary|overview|summary)[\s\S]*?(?=\n\s*(?:problem|solution|requirements|success|metrics|timeline)|$)/i, title: 'Executive Summary' },
                    { pattern: /(problem statement|problem|challenge)[\s\S]*?(?=\n\s*(?:solution|requirements|success|metrics|timeline)|$)/i, title: 'Problem Statement' },
                    { pattern: /(solution|approach|proposal)[\s\S]*?(?=\n\s*(?:requirements|success|metrics|timeline)|$)/i, title: 'Solution Approach' },
                    { pattern: /(requirements|specs|specifications)[\s\S]*?(?=\n\s*(?:success|metrics|timeline)|$)/i, title: 'Requirements' },
                    { pattern: /(success criteria|success metrics|metrics|kpis)[\s\S]*?(?=\n\s*(?:timeline)|$)/i, title: 'Success Criteria' }
                  ];

                  prdPatterns.forEach(({ pattern, title }) => {
                    const match = content.match(pattern);
                    if (match) {
                      sections.push({
                        title,
                        content: match[0].trim(),
                        type: 'section'
                      });
                    }
                  });
                }

                // If still no sections found, chunk by paragraphs
                if (sections.length === 0) {
                  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
                  paragraphs.forEach((paragraph, index) => {
                    sections.push({
                      title: `Part ${index + 1}`,
                      content: paragraph.trim(),
                      type: 'chunk'
                    });
                  });
                }
              }

              return sections.length > 0 ? sections : [{ title: 'Complete Document', content: content, type: 'full' }];
            };

            // Helper function to generate metadata
            const generateMetadata = (section: any, docType: string, projectName?: string, priority?: string, tags?: string[]) => {
              const timestamp = new Date().toISOString();
              return `PROJECT: ${projectName || 'Unknown'}
DOCUMENT_TYPE: ${docType}
SECTION: ${section.title}
PRIORITY: ${priority || 'Medium'}
TAGS: ${tags ? tags.join(', ') : 'document, ' + docType.toLowerCase()}
TIMESTAMP: ${timestamp}
SECTION_TYPE: ${section.type}

${section.content}`;
            };

            // Detect document type if not provided
            const finalDocType = documentType || detectDocumentType(thingToRemember);

            // Parse document into sections
            const sections = parseDocumentSections(thingToRemember, finalDocType);

            const storedSections = [];
            let successCount = 0;

            // Store each section with metadata
            for (const section of sections) {
              try {
                const formattedContent = generateMetadata(section, finalDocType, projectName, priority, tags);
                const memoryId = await storeMemory(formattedContent, this.props.userId, env);
                await storeMemoryInD1(formattedContent, this.props.userId, env, memoryId);

                storedSections.push({
                  title: section.title,
                  type: section.type,
                  memoryId: memoryId
                });
                successCount++;
              } catch (sectionError) {
                console.error(`Error storing section "${section.title}":`, sectionError);
              }
            }

            // Store a master index entry
            try {
              const masterContent = `PROJECT: ${projectName || 'Unknown'}
DOCUMENT_TYPE: ${finalDocType}
SECTION: Master Index
PRIORITY: ${priority || 'Medium'}
TAGS: ${tags ? tags.join(', ') : 'document, ' + finalDocType.toLowerCase()}, master-index
TIMESTAMP: ${new Date().toISOString()}
SECTION_COUNT: ${sections.length}

DOCUMENT OVERVIEW:
This document has been stored in ${sections.length} sections: ${sections.map(s => s.title).join(', ')}

STORED SECTIONS:
${storedSections.map(s => `- ${s.title} (${s.type}): ${s.memoryId}`).join('\n')}`;

              const masterMemoryId = await storeMemory(masterContent, this.props.userId, env);
              await storeMemoryInD1(masterContent, this.props.userId, env, masterMemoryId);
            } catch (masterError) {
              console.error('Error storing master index:', masterError);
            }

            console.log(`Successfully stored ${successCount}/${sections.length} sections for ${finalDocType} document`);

            return {
              content: [{
                type: "text",
                text: `Remembered ${finalDocType} document with ${successCount}/${sections.length} sections stored:\n${storedSections.map(s => `✓ ${s.title}`).join('\n')}\n\nDocument tagged with: ${tags ? tags.join(', ') : finalDocType.toLowerCase()}`
              }],
            };
          } catch (error) {
            console.error("Error storing artifact:", error);
            return {
              content: [{ type: "text", text: "Failed to remember artifact: " + String(error) }],
            };
          }
        }
    );

    this.server.tool(
        "search_artifacts",
        `Search for stored artifacts with advanced filtering options. Use it when:
      1. User wants to find specific documents by type, project, or content
      2. User needs to locate artifacts created in previous sessions
      3. User wants to filter artifacts by tags, priority, or other metadata

      Returns matching artifacts with their metadata and content snippets.`,
        {
          documentType: z.string().optional().describe("Filter by document type: PRD, TechnicalSpec, FeatureRequest, Documentation"),
          projectName: z.string().optional().describe("Filter by project name"),
          tags: z.array(z.string()).optional().describe("Filter by tags (must contain all specified tags)"),
          priority: z.string().optional().describe("Filter by priority: High, Medium, Low"),
          keywords: z.string().optional().describe("Search for keywords in document content"),
          sectionType: z.string().optional().describe("Filter by section type: section, chunk, full, master-index")
        },
        async ({ documentType, projectName, tags, priority, keywords, sectionType }) => {
          try {
            // Build search query combining all criteria
            let searchQuery = "";
            const metadataFilters: Record<string, string> = {};

            if (documentType) metadataFilters.DOCUMENT_TYPE = documentType;
            if (projectName) metadataFilters.PROJECT = projectName;
            if (priority) metadataFilters.PRIORITY = priority;
            if (sectionType) metadataFilters.SECTION_TYPE = sectionType;

            // For tags, we'll still use the semantic search approach since tags are space-separated
            // and Vectorize metadata filtering doesn't support "contains" operations
            if (tags && tags.length > 0) {
              searchQuery += ` TAGS: ${tags.join(' ')}`;
            }

            // Add keywords to search query
            if (keywords) {
              searchQuery += ` ${keywords}`;
            }

            // If no filters, search for any document with document type
            if (Object.keys(metadataFilters).length === 0 && !searchQuery.trim()) {
              searchQuery = "DOCUMENT_TYPE:";
            }

            console.log(`Searching artifacts with query: "${searchQuery}" and filters:`, metadataFilters);

            // Use existing search function with metadata filters
            const memories = await searchMemories(searchQuery || "document", this.props.userId, env, metadataFilters);

            if (memories.length === 0) {
              return {
                content: [{ type: "text", text: "No artifacts found matching your criteria." }],
              };
            }

            // Parse and filter results based on metadata
            const artifacts = [];
            for (const memory of memories) {
              const lines = memory.content.split('\n');
              const metadata: any = {};
              let contentStart = 0;

              // Parse metadata
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes(': ')) {
                  const [key, value] = line.split(': ', 2);
                  metadata[key] = value;
                } else if (line === '') {
                  contentStart = i + 1;
                  break;
                }
              }

              // Apply additional filtering for tags if specified
              if (tags && tags.length > 0) {
                const artifactTags = (metadata.TAGS || '').split(',').map((t: string) => t.trim());
                if (!tags.every(tag => artifactTags.includes(tag))) continue;
              }

              const content = lines.slice(contentStart).join('\n').trim();
              const snippet = content.length > 200 ? content.substring(0, 200) + '...' : content;

              artifacts.push({
                id: memory.id || 'unknown',
                score: memory.score,
                metadata,
                snippet,
                contentLength: content.length
              });
            }

            if (artifacts.length === 0) {
              return {
                content: [{ type: "text", text: "No artifacts found matching your specific criteria." }],
              };
            }

            // Sort by score (relevance)
            artifacts.sort((a, b) => b.score - a.score);

            const resultText = `Found ${artifacts.length} matching artifacts:\n\n` +
                artifacts.map((artifact, index) => {
                  const meta = artifact.metadata;
                  return `**${index + 1}. ${meta.SECTION || 'Unknown Section'}**
📁 Project: ${meta.PROJECT || 'Unknown'}
📄 Type: ${meta.DOCUMENT_TYPE || 'Unknown'}
🏷️ Tags: ${meta.TAGS || 'None'}
⚡ Priority: ${meta.PRIORITY || 'Medium'}
📅 Date: ${meta.TIMESTAMP ? new Date(meta.TIMESTAMP).toLocaleDateString() : 'Unknown'}
📊 Score: ${artifact.score.toFixed(3)}
📝 Content: ${artifact.snippet}

---`;
                }).join('\n\n');

            return {
              content: [{ type: "text", text: resultText }],
            };
          } catch (error) {
            console.error("Error searching artifacts:", error);
            return {
              content: [{ type: "text", text: "Failed to search artifacts: " + String(error) }],
            };
          }
        }
    );

    this.server.tool(
        "reconstruct_artifact",
        `Reconstructs a complete document from its stored sections. Use it when:
      1. User wants to view the complete document that was stored in sections
      2. User needs to recreate the original artifact for editing or reference
      3. User wants to see the full context of a previously stored document

      This tool finds all sections belonging to a document and reassembles them.`,
        {
          projectName: z.string().describe("Project name of the document to reconstruct"),
          documentType: z.string().describe("Document type: PRD, TechnicalSpec, FeatureRequest, Documentation"),
          masterIndexId: z.string().optional().describe("Optional: Master index ID if known")
        },
        async ({ projectName, documentType, masterIndexId }) => {
          try {
            // Search for all sections of this document using metadata filters for exact matching
            const searchQuery = `${projectName} ${documentType}`; // Simple query for embedding generation
            const metadataFilters = {
              PROJECT: projectName,
              DOCUMENT_TYPE: documentType
            };
            
            console.log(`Reconstructing document with query: "${searchQuery}" and filters:`, metadataFilters);

            const memories = await searchMemories(searchQuery, this.props.userId, env, metadataFilters);

            if (memories.length === 0) {
              return {
                content: [{ type: "text", text: `No sections found for ${documentType} in project "${projectName}".` }],
              };
            }

            // Parse all sections and find master index
            const sections = [];
            let masterIndex = null;

            for (const memory of memories) {
              const lines = memory.content.split('\n');
              const metadata: any = {};
              let contentStart = 0;

              // Parse metadata
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes(': ')) {
                  const [key, value] = line.split(': ', 2);
                  metadata[key] = value;
                } else if (line === '') {
                  contentStart = i + 1;
                  break;
                }
              }

              const content = lines.slice(contentStart).join('\n').trim();

              if (metadata.SECTION === 'Master Index') {
                masterIndex = { metadata, content, id: memory.id };
              } else {
                sections.push({
                  metadata,
                  content,
                  id: memory.id,
                  sectionName: metadata.SECTION || 'Unknown Section',
                  sectionType: metadata.SECTION_TYPE || 'section'
                });
              }
            }

            if (sections.length === 0 && !masterIndex) {
              return {
                content: [{ type: "text", text: `No document sections found for ${documentType} in project "${projectName}".` }],
              };
            }

            // Sort sections (try to maintain logical order)
            sections.sort((a, b) => {
              // Prioritize certain section types
              const order = {
                'Executive Summary': 1,
                'Overview': 2,
                'Problem Statement': 3,
                'Solution Approach': 4,
                'Requirements': 5,
                'Success Criteria': 6,
                'Timeline': 7
              };

              const aOrder = order[a.sectionName as keyof typeof order] || 999;
              const bOrder = order[b.sectionName as keyof typeof order] || 999;

              if (aOrder !== bOrder) return aOrder - bOrder;
              return a.sectionName.localeCompare(b.sectionName);
            });

            // Build reconstructed document
            const docInfo = masterIndex?.metadata || sections[0]?.metadata || {};
            const timestamp = docInfo.TIMESTAMP ? new Date(docInfo.TIMESTAMP).toLocaleString() : 'Unknown';

            let reconstructedDoc = `# ${documentType}: ${projectName}

**Document Information:**
- 📁 Project: ${projectName}
- 📄 Type: ${documentType}
- 🏷️ Tags: ${docInfo.TAGS || 'None'}
- ⚡ Priority: ${docInfo.PRIORITY || 'Medium'}
- 📅 Created: ${timestamp}
- 📊 Sections: ${sections.length}

---

`;

            // Add all sections
            for (const section of sections) {
              reconstructedDoc += `## ${section.sectionName}

${section.content}

---

`;
            }

            // Add master index info if available
            if (masterIndex) {
              reconstructedDoc += `
**Master Index Information:**
${masterIndex.content}`;
            }

            return {
              content: [{
                type: "text",
                text: `Successfully reconstructed ${documentType} document:

${reconstructedDoc}`
              }],
            };
          } catch (error) {
            console.error("Error reconstructing artifact:", error);
            return {
              content: [{ type: "text", text: "Failed to reconstruct artifact: " + String(error) }],
            };
          }
        }
    );

    this.server.tool(
        "list_artifacts_by_project",
        `Lists all artifacts stored for a specific project. Use it when:
      1. User wants to see all documents associated with a project
      2. User needs an overview of what artifacts exist for a project
      3. User wants to browse available documents before reconstructing them

      Returns a summary of all artifacts with metadata for the specified project.`,
        {
          projectName: z.string().describe("Name of the project to list artifacts for")
        },
        async ({ projectName }) => {
          try {
            console.log(`Listing artifacts for project: "${projectName}"`);

            // Search for all artifacts in this project using metadata filter
            const searchQuery = projectName;
            const metadataFilters = { PROJECT: projectName };
            const memories = await searchMemories(searchQuery, this.props.userId, env, metadataFilters);

            if (memories.length === 0) {
              return {
                content: [{ type: "text", text: `No artifacts found for project "${projectName}".` }],
              };
            }

            // Group artifacts by document type and collect metadata
            const artifactMap = new Map();

            for (const memory of memories) {
              const lines = memory.content.split('\n');
              const metadata: any = {};

              // Parse metadata
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.includes(': ')) {
                  const [key, value] = line.split(': ', 2);
                  metadata[key] = value;
                } else if (line === '') {
                  break;
                }
              }

              // Extract document information
              const docType = metadata.DOCUMENT_TYPE || 'Unknown';
              const section = metadata.SECTION || 'Unknown Section';
              const sectionType = metadata.SECTION_TYPE || 'section';

              if (!artifactMap.has(docType)) {
                artifactMap.set(docType, {
                  type: docType,
                  sections: [],
                  masterIndex: null,
                  metadata: metadata
                });
              }

              const artifact = artifactMap.get(docType);

              if (section === 'Master Index') {
                artifact.masterIndex = { section, metadata, id: memory.id };
              } else {
                artifact.sections.push({ section, sectionType, metadata, id: memory.id });
              }
            }

            if (artifactMap.size === 0) {
              return {
                content: [{ type: "text", text: `No artifacts found for project "${projectName}".` }],
              };
            }

            // Build summary
            let summary = `# Artifacts for Project: ${projectName}

`;
            summary += `Found ${artifactMap.size} document type(s) with ${memories.length} total sections:

`;

            for (const [docType, artifact] of artifactMap.entries()) {
              const meta = artifact.metadata;
              const timestamp = meta.TIMESTAMP ? new Date(meta.TIMESTAMP).toLocaleDateString() : 'Unknown';

              summary += `## ${docType}
`;
              summary += `- 🏷️ **Tags:** ${meta.TAGS || 'None'}
`;
              summary += `- ⚡ **Priority:** ${meta.PRIORITY || 'Medium'}
`;
              summary += `- 📅 **Date:** ${timestamp}
`;
              summary += `- 📊 **Sections:** ${artifact.sections.length}${artifact.masterIndex ? ' + Master Index' : ''}
`;

              if (artifact.sections.length > 0) {
                summary += `- 📝 **Section List:**
`;
                artifact.sections.forEach((sec: any, idx: number) => {
                  summary += `  ${idx + 1}. ${sec.section} (${sec.sectionType})
`;
                });
              }

              summary += `
*Use reconstruct_artifact to view the complete ${docType} document.*

---

`;
            }

            return {
              content: [{ type: "text", text: summary }],
            };
          } catch (error) {
            console.error("Error listing artifacts:", error);
            return {
              content: [{ type: "text", text: "Failed to list artifacts: " + String(error) }],
            };
          }
        }
    );
  }
}
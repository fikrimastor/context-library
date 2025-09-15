import { v4 as uuidv4 } from "uuid";

// Minimum similarity score for vector search results
const MINIMUM_SIMILARITY_SCORE = 0.5;

/**
 * Generates vector embeddings from text using Cloudflare's AI model
 *
 * @param text - The text to convert into vector embeddings
 * @param env - Environment containing AI service access
 * @returns Promise resolving to an array of numerical values representing the text embedding
 */
async function generateEmbeddings(text: string, env: Env): Promise<number[]> {
  const embeddings = (await env.AI.run("@cf/baai/bge-m3", {
    text,
  })) as AiTextEmbeddingsOutput;

  const values = embeddings.data[0];
  if (!values) throw new Error("Failed to generate vector embedding");

  return values;
}

/**
 * Stores a memory in Vectorize with its vector embedding and returns the generated ID
 * @param text - The memory content to store
 * @param userId - User ID to associate with the memory (used as namespace)
 * @param env - Environment containing Vectorize and AI services
 * @returns Promise resolving to the unique memory ID
 */
export async function storeMemory(text: string, userId: string, env: Env): Promise<string> {
  const memoryId = uuidv4();

  // Generate embedding
  const values = await generateEmbeddings(text, env);

  // Store in Vectorize
  await env.VECTORIZE.upsert([
    {
      id: memoryId,
      values,
      namespace: userId,
      metadata: { content: text, type: "memory" },
    },
  ]);

  return memoryId;
}

/**
 * Search for memories by semantic similarity
 * @param query - The query to search for
 * @param userId - User ID to search within (used as namespace)
 * @param env - Environment containing Vectorize service
 * @param metadataFilters - Optional metadata filters to apply
 * @returns Promise resolving to an array of memories matching the query
 */
export async function searchMemories(
    query: string,
    userId: string,
    env: Env,
    metadataFilters?: Record<string, string>
): Promise<Array<{ content: string; score: number; id: string }>> {
  // Generate embedding for query
  const queryVector = await generateEmbeddings(query, env);

  // Prepare query options
  const queryOptions: any = {
    namespace: userId,
    topK: 10,
    returnMetadata: "all",
  };

  // Add metadata filters if provided
  if (metadataFilters) {
    queryOptions.filter = metadataFilters;
  }

  // Search Vectorize
  const results = await env.VECTORIZE.query(queryVector, queryOptions);

  if (!results.matches || results.matches.length === 0) {
    return [];
  }

  // Process results
  const memories = results.matches
      .filter((match) => match.score > MINIMUM_SIMILARITY_SCORE)
      .map((match) => {
        // Ensure content is a string
        let content = "Missing memory content";

        if (match.metadata && typeof match.metadata.content === "string") {
          content = match.metadata.content;
        } else if (match.id) {
          content = `Missing memory content (ID: ${match.id})`;
        }

        return {
          content,
          score: match.score || 0,
          id: match.id,
        };
      });

  // Sort by relevance score (highest first)
  memories.sort((a, b) => b.score - a.score);

  return memories;
}

// Check if memory exists in Vectorize index
export async function checkMemoryExistsInVectorize(memoryId: string, userId: string, env: Env): Promise<boolean> {
  try {
    const results = await env.VECTORIZE.query([0], {
      namespace: userId,
      topK: 1,
      filter: { id: memoryId },
      returnMetadata: false,
    });
    
    return results.matches && results.matches.some(match => match.id === memoryId);
  } catch (error) {
    console.error(`Error checking if memory ${memoryId} exists in Vectorize:`, error);
    return false;
  }
}

// Restore missing memories from D1 to Vectorize
export async function restoreMissingMemoriesToVectorize(userId: string, env: Env): Promise<{
  restored: number;
  errors: Array<{ memoryId: string; error: string }>;
}> {
  const errors: Array<{ memoryId: string; error: string }> = [];
  let restored = 0;
  
  try {
    // Get all memories from D1 for this user
    const { getAllMemoriesFromD1 } = await import('./db');
    const memories = await getAllMemoriesFromD1(userId, env);
    
    if (memories.length === 0) {
      return { restored, errors };
    }

    // Process memories in small chunks to avoid subrequest limits
    // Each memory = 1 AI call + batch check + batch upsert per chunk
    const CHUNK_SIZE = 10; // Reduced to 10 to stay well under subrequest limits
    const chunks = [];
    
    for (let i = 0; i < memories.length; i += CHUNK_SIZE) {
      chunks.push(memories.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Processing ${memories.length} memories in ${chunks.length} chunks for user ${userId}`);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} (${chunk.length} memories)`);

      try {
        // Batch check which memories exist in Vectorize
        const memoryIds = chunk.map(m => m.id);
        const existingVectors = await env.VECTORIZE.getByIds(memoryIds);
        const existingIds = new Set(existingVectors.map(v => v.id));
        
        // Filter to only missing memories
        const missingMemories = chunk.filter(memory => !existingIds.has(memory.id));
        
        if (missingMemories.length === 0) {
          console.log(`Chunk ${chunkIndex + 1}: All memories already exist in Vectorize`);
          continue;
        }

        console.log(`Chunk ${chunkIndex + 1}: Found ${missingMemories.length} missing memories to restore`);

        // Generate embeddings with rate limiting to avoid subrequest limits
        const vectorsToUpsert = [];
        
        for (let i = 0; i < missingMemories.length; i++) {
          const memory = missingMemories[i];
          try {
            // Add small delay between AI calls to be nice to rate limits
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            const values = await generateEmbeddings(memory.content, env);
            vectorsToUpsert.push({
              id: memory.id,
              values,
              namespace: userId,
              metadata: { content: memory.content, type: "memory" },
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ memoryId: memory.id, error: `Failed to generate embedding: ${errorMessage}` });
            console.error(`Failed to generate embedding for memory ${memory.id}:`, error);
          }
        }

        // Batch upsert all vectors for this chunk
        if (vectorsToUpsert.length > 0) {
          await env.VECTORIZE.upsert(vectorsToUpsert);
          restored += vectorsToUpsert.length;
          console.log(`Chunk ${chunkIndex + 1}: Successfully restored ${vectorsToUpsert.length} memories`);
        }

        // Longer delay between chunks to respect rate limits
        if (chunkIndex < chunks.length - 1) {
          console.log(`Waiting before processing next chunk...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Add error for all memories in this chunk
        for (const memory of chunk) {
          errors.push({ memoryId: memory.id, error: `Chunk processing failed: ${errorMessage}` });
        }
        console.error(`Failed to process chunk ${chunkIndex + 1}:`, error);
      }
    }
    
    return { restored, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push({ memoryId: 'unknown', error: `Failed to get memories from D1: ${errorMessage}` });
    return { restored, errors };
  }
}

/**
 * Updates a memory vector embedding
 * @param memoryId - ID of the memory to update
 * @param newContent - New content for the memory
 * @param userId - User ID to associate with the memory (used as namespace)
 * @param env - Environment containing Vectorize service
 */
export async function updateMemoryVector(
    memoryId: string,
    newContent: string,
    userId: string,
    env: Env
): Promise<void> {
  // Generate new embedding
  const newValues = await generateEmbeddings(newContent, env);

  // Upsert into Vectorize to update
  await env.VECTORIZE.upsert([
    {
      id: memoryId,
      values: newValues,
      namespace: userId,
      metadata: { content: newContent, type: "memory" }, // Update metadata as well
    },
  ]);

  console.log(`Vector for memory ${memoryId} (namespace ${userId}) updated.`);
}

/**
 * Deletes a vector by its ID from the Vectorize index
 * @param memoryId - ID of the memory to delete
 * @param userId - User ID to associate with the memory (used as namespace)
 * @param env - Environment containing Vectorize service
 */
export async function deleteVectorById(memoryId: string, userId: string, env: Env): Promise<void> {
  try {
    // todo WARNING: This might delete the ID globally if namespaces are not implicitly handled.
    // Further investigation needed on how Vectorize handles namespaces during deletion.
    const result = await env.VECTORIZE.deleteByIds([memoryId]);
    console.log(
        `Attempted global deletion for vector ID ${memoryId}. Deletion was requested for user (namespace): ${userId} Result:`,
        result
    );
  } catch (error) {
    console.error(`Error deleting vector ID ${memoryId} from Vectorize namespace ${userId}:`, error);
    throw error;
  }
}
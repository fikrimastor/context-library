import { v4 as uuidv4 } from 'uuid';

/**
 * Ensures the memories table exists in D1
 */
export async function initializeDatabase(env: Env): Promise<void> {
    try {
        await env.DB.exec("CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, userId TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
        console.log("Checked/Created memories table in D1.");
    } catch (e) {
        console.error("Failed to create memories table in D1:", e);
        throw e;
    }
}

/**
 * Stores a memory in D1 database
 * @param content Memory content to store
 * @param userId User ID to associate with memory
 * @param memoryId Optional ID, will generate UUID if not provided
 * @returns Memory ID
 */
export async function storeMemoryInD1(
    content: string,
    userId: string,
    env: Env,
    memoryId: string = uuidv4()
): Promise<string> {
    try {
        const stmt = env.DB.prepare(
            "INSERT INTO memories (id, userId, content) VALUES (?, ?, ?)"
        );

        await stmt.bind(memoryId, userId, content).run();
        console.log(`Memory stored in D1 with ID: ${memoryId}`);

        return memoryId;
    } catch (error) {
        console.error("Error storing memory in D1:", error);
        throw error;
    }
}

/**
 * Retrieves all memories for a user from D1
 * @param userId User ID to retrieve memories for
 * @returns Array of memory objects
 */
export async function getAllMemoriesFromD1(userId: string, env: Env): Promise<Array<{id: string, content: string}>> {
    try {
        const result = await env.DB.prepare(
            "SELECT id, content FROM memories WHERE userId = ? ORDER BY created_at DESC"
        ).bind(userId).all();

        return result.results as Array<{id: string, content: string}>;
    } catch (error) {
        console.error("Error retrieving memories from D1:", error);
        throw error;
    }
}

/**
 * Deletes a memory from D1
 * @param memoryId ID of memory to delete
 * @param userId User ID associated with memory
 */
export async function deleteMemoryFromD1(memoryId: string, userId: string, env: Env): Promise<void> {
    try {
        await env.DB.prepare(
            "DELETE FROM memories WHERE id = ? AND userId = ?"
        ).bind(memoryId, userId).run();

        console.log(`Memory ${memoryId} deleted from D1`);
    } catch (error) {
        console.error("Error deleting memory from D1:", error);
        throw error;
    }
}

/**
 * Updates the content of a memory in D1
 * @param memoryId ID of the memory to update
 * @param userId User ID associated with the memory
 * @param newContent The new content for the memory
 * @param env Environment object containing the DB binding
 */
export async function updateMemoryInD1(memoryId: string, userId: string, newContent: string, env: Env): Promise<void> {
    try {
        const stmt = env.DB.prepare(
            "UPDATE memories SET content = ? WHERE id = ? AND userId = ?"
        );
        const result = await stmt.bind(newContent, memoryId, userId).run();

        // Check the meta property for changes
        if (!result.meta || result.meta.changes === 0) {
            throw new Error(`Memory with ID ${memoryId} not found for user ${userId} or content unchanged.`);
        }

        console.log(`Memory ${memoryId} updated in D1`);
    } catch (error) {
        console.error("Error updating memory in D1:", error);
        throw error;
    }
}

/**
 * Retrieves recent activities (memories and journals) for a user from D1
 * @param userId User ID to retrieve activities for
 * @param limit Maximum number of activities to retrieve
 * @returns Array of recent activities
 */
export async function getRecentActivitiesFromD1(userId: string, env: Env, limit: number = 20): Promise<Array<{id: string, type: 'memory' | 'journal', title: string | null, content: string, created_at: string}>> {
    try {
        // Get recent memories
        const memories = await env.DB.prepare(
            "SELECT id, 'memory' as type, NULL as title, content, created_at FROM memories WHERE userId = ? ORDER BY created_at DESC LIMIT ?"
        ).bind(userId, Math.ceil(limit/2)).all();

        // Get recent journals
        const journals = await env.DB.prepare(
            "SELECT id, 'journal' as type, title, content, created_at FROM journals WHERE userId = ? ORDER BY created_at DESC LIMIT ?"
        ).bind(userId, Math.ceil(limit/2)).all();

        // Combine and sort by date
        const activities = [
            ...(memories.results || []),
            ...(journals.results || [])
        ] as Array<{id: string, type: 'memory' | 'journal', title: string | null, content: string, created_at: string}>;

        // Sort by created_at descending (most recent first)
        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Limit to requested number
        return activities.slice(0, limit);
    } catch (error) {
        console.error("Error retrieving recent activities from D1:", error);
        throw error;
    }
}
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'WebSearch',
  version: '1.0.0',
});

server.tool('search', { query: z.string() }, async ({ query }) => {
  // In a real implementation, this would connect to a search API
  // For this demo, we'll simulate search results
  console.log(`[WebSearch] Searching for: ${query}`);
  
  // Simulate a delay for realistic behavior
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    content: [
      { 
        type: 'text', 
        text: `Search results for "${query}":\n` +
              `1. Example result 1 related to ${query}\n` +
              `2. Example result 2 related to ${query}\n` +
              `3. Example result 3 related to ${query}\n` +
              `Note: This is a simulated search result for demonstration purposes.`
      }
    ],
  };
});

async function main() {
  try {
    console.log("[WebSearch Server] Starting...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("[WebSearch Server] Connected");
  } catch (error) {
    console.error("[WebSearch Server] Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[WebSearch Server] Fatal error:", error);
  process.exit(1);
});
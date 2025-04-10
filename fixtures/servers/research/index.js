import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Research',
  version: '1.0.0',
});

server.tool('deep_research', { topic: z.string() }, async ({ topic }) => {
  console.log(`[Research] Researching topic: ${topic}`);
  
  // Simulate research delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    content: [
      { 
        type: 'text', 
        text: `In-depth research on "${topic}":\n\n` +
              `## Overview\n` +
              `${topic} is a complex subject with multiple aspects to consider.\n\n` +
              `## Key Points\n` +
              `- First important point about ${topic}\n` +
              `- Second important consideration regarding ${topic}\n` +
              `- Historical context of ${topic}\n\n` +
              `## Analysis\n` +
              `The current understanding of ${topic} suggests that further research is needed in several areas.\n\n` +
              `Note: This is simulated research content for demonstration purposes.`
      }
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
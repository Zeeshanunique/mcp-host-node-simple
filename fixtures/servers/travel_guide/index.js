import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'TravelGuide',
  version: '1.0.0',
});

server.tool('get_destination_info', { 
  destination: z.string(),
  interests: z.array(z.string()).optional()
}, async ({ destination, interests = [] }) => {
  console.log(`[TravelGuide] Getting travel information for: ${destination}`);
  if (interests.length > 0) {
    console.log(`[TravelGuide] Interests: ${interests.join(', ')}`);
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate travel guide information
  const interestsInfo = interests.length > 0 
    ? `\n\nBased on your interests (${interests.join(', ')}), we recommend:\n` +
      interests.map(interest => `- ${interest.charAt(0).toUpperCase() + interest.slice(1)} activities in ${destination}: Various options available`).join('\n')
    : '';
  
  return {
    content: [
      { 
        type: 'text', 
        text: `Travel Guide for ${destination}:\n\n` +
              `## Overview\n` +
              `${destination} is a wonderful destination with much to offer visitors.\n\n` +
              `## Top Attractions\n` +
              `- Famous landmark #1 in ${destination}\n` +
              `- Popular museum in ${destination}\n` +
              `- Beautiful natural area near ${destination}\n\n` +
              `## Practical Information\n` +
              `- Currency: Local currency\n` +
              `- Language: Local language\n` +
              `- Best time to visit: Spring and Fall${interestsInfo}\n\n` +
              `Note: This is simulated travel guide information for demonstration purposes.`
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
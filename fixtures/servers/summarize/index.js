import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Summarize',
  version: '1.0.0',
});

server.tool('summarize_text', { text: z.string() }, async ({ text }) => {
  console.log(`[Summarize] Summarizing text of length: ${text.length}`);
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Create a simple summary (in a real app, this would use NLP)
  // For demo, we'll just take the first sentence and add a generic summary
  const firstSentence = text.split('.')[0];
  
  return {
    content: [
      { 
        type: 'text', 
        text: `Summary of the provided text:\n\n` +
              `"${firstSentence}..."\n\n` +
              `The text discusses key concepts related to the main topic and provides several insights into the subject matter. ` +
              `The main points cover various aspects of the topic with supporting details.\n\n` +
              `Note: This is a simulated summary for demonstration purposes.`
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
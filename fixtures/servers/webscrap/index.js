import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'WebScrap',
  version: '1.0.0',
});

server.tool('scrape_url', { url: z.string().url() }, async ({ url }) => ({
  content: [{ type: 'text', text: `Scraped content from ${url}` }], // Placeholder implementation
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 
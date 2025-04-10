import './backend/server.js';
import { LLMClient, LLMToolResults } from "./llm-client.js";
import { AnthropicProvider } from "./llm-provider.js";
import { MCPHost } from "./mcp-host.js";

// This file serves as the main entry point for Vercel deployment
// The actual server code is in backend/server.js
console.log('[Main] Server imported and running');

async function main() {
  const host = new MCPHost();
  await host.start({
    mcpServerConfig: "./mcp-servers.json", // This path is okay for local dev
  });

  const llm = new LLMClient({ provider: new AnthropicProvider() });

  llm.append("user", "Use add tool to calculate numbers 100 + 1000?");

  const { toolResults, text: toolResponse } = await llm.generate({
    tools: await host.tools(),
  });

  console.log("[Assistant]", toolResponse);

  for (const toolResult of toolResults as LLMToolResults) {
    // Ensure proper type checking or use 'any' if necessary for content access
    const content = (toolResult.result as any)?.content;
    if (Array.isArray(content) && content[0]?.text) {
      llm.append("user", content[0].text);
    }
  }

  const { text: assistantResponse } = await llm.generate();

  console.log("[Assistant]", assistantResponse);

  process.exit(0);
}

main();
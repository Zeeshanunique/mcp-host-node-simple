import { LLMClient, LLMToolResults } from "./llm-client.js";
import { AzureOpenAIProvider } from "./llm-provider.js";
import { MCPHost } from "./mcp-host.js";

async function main() {
  try {
    console.log('Testing AzureOpenAIProvider with MCPHost...');
    
    // Start the MCPHost
    const host = new MCPHost();
    await host.start({
      mcpServerConfig: "./mcp-servers.json", // This path is okay for local dev
    });
    
    // Initialize LLMClient with AzureOpenAIProvider
    const llm = new LLMClient({ provider: new AzureOpenAIProvider() });

    // Add a user message with a calculation request
    llm.append("user", "Use calculate tool to add 42 + 33");

    // Generate a response
    const { toolResults, text: toolResponse } = await llm.generate({
      tools: await host.tools(),
    });

    console.log('[Assistant Tool Response]', toolResponse);

    // Print tool results
    for (const toolResult of toolResults as LLMToolResults) {
      // Ensure proper type checking or use 'any' for content access
      const content = (toolResult.result as any)?.content;
      if (Array.isArray(content) && content[0]?.text) {
        console.log('[Tool Result]', content[0].text);
        llm.append("user", content[0].text);
      }
    }

    // Generate a final response
    const { text: assistantResponse } = await llm.generate();

    console.log('[Final Assistant Response]', assistantResponse);
    
    // Clean exit
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 
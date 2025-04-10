console.log('[Server Start] Loading modules...');
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MCPHost } from '../mcp-host.js';
import { LLMClient } from '../llm-client.js';
import { AnthropicProvider } from '../llm-provider.js';
import { CoreMessage } from 'ai'; // Restore import
import path from 'path';
import { fileURLToPath } from 'url';
console.log('[Server Start] Modules loaded.');

// Get directory paths for proper file resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('[Server Start] Initializing Express...');
const app = express();
console.log('[Server Start] Express initialized.');
const port = process.env.PORT || 3001;

// Initialize MCP host
console.log('[Server Start] Initializing MCPHost...');
const host = new MCPHost();
console.log('[Server Start] MCPHost initialized.');
let tools: Record<string, any> = {};

// Middleware
console.log('[Server Start] Applying middleware...');
app.use(cors());
app.use(express.json());
console.log('[Server Start] Middleware applied.');

// Initialize MCP host and tools
async function initializeHost() {
  try {
    // Use appropriate path resolution for both dev and production
    const mcpConfigPath = path.resolve(rootDir, "mcp-servers.json");
    console.log("[Server] Looking for MCP config at:", mcpConfigPath);

    await host.start({
      mcpServerConfig: mcpConfigPath,
    });
    tools = await host.tools();
    console.log("[Server] MCP Host initialized with tools:", await host.toolList());
  } catch (error) {
    console.error("[Server] Error initializing MCP host:", error);
    // Continue with whatever tools were loaded successfully
    tools = await host.tools();
    console.log("[Server] Continuing with available tools:", await host.toolList());
  }
}

// API endpoints - Use proper route method typing
app.post('/api/chat', (req: Request, res: Response) => {
  (async () => {
    try {
      // Destructure history from the request body
      const { history } = req.body as { history: CoreMessage[] }; 

      // Validate history (basic check)
      if (!history || !Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: 'History is required and must be a non-empty array' });
      }

      // Get the last user message from the history
      const lastMessage = history[history.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
          return res.status(400).json({ error: 'Last message in history must be from the user' });
      }
      
      // Use the provided history to initialize the LLM client
      const llm = new LLMClient({
        provider: new AnthropicProvider(),
        // Pass history (excluding the last user message, as generate adds it)
        // UPDATE: Pass the full history. The LLMClient likely handles the messages array directly.
        initialMessages: history 
      });
      
      // No need to append the last message manually if LLMClient uses initialMessages
      // llm.append("user", lastMessage.content);

      console.log('[Server] Generating response with history:', llm.messages());

      // Capture the full response object from the initial generate call
      const initialGenerationResult = await llm.generate({
        tools
      });
      
      const toolResponseText = initialGenerationResult.text;
      const toolResults = initialGenerationResult.toolResults;
      // Extract the assistant's message which should contain tool_calls
      const assistantMessage = initialGenerationResult.response.messages.find(m => m.role === 'assistant');

      console.log('[Server] Initial response text:', toolResponseText);
      console.log('[Server] Tool results:', toolResults);
      console.log('[Server] Assistant message object:', assistantMessage);

      let finalAssistantResponseText: string | null = null;

      if (toolResults && toolResults.length > 0) {
          
          // Append the *full* assistant message (containing tool_calls)
          if (assistantMessage) {
            // We might need to ensure the structure matches CoreMessage exactly
            // Assuming the message from generateText is compatible
            llm.append('assistant', assistantMessage.content);
          } else {
             // Fallback if assistant message extraction fails (should not happen with tool calls)
             console.warn('[Server] Could not find assistant message with tool calls');
             if (toolResponseText) {
               llm.append('assistant', toolResponseText);
             }
          }
          
          // Add tool results to messages
          for (const toolResult of toolResults) {
               const toolCallId = (toolResult as any).toolCallId || `tool_${Date.now()}`;
               const toolResultContent = (toolResult as any).result?.content;
               const resultText = Array.isArray(toolResultContent) && toolResultContent[0]?.text
                                  ? toolResultContent[0].text
                                  : JSON.stringify((toolResult as any).result);
              
               llm.append('tool', {
                   type: 'tool-result',
                   toolCallId: toolCallId,
                   toolName: (toolResult as any).toolName || 'unknown',
                   result: resultText
               });
          }
          
          console.log('[Server] Generating final response after tools:', llm.messages());
          // Generate the final response *after* adding tool results
          const finalGenerationResult = await llm.generate(); // No tools needed here
          finalAssistantResponseText = finalGenerationResult.text;
          console.log('[Server] Final response after tools:', finalAssistantResponseText);
      }
      
      // Prepare the response payload
      return res.json({ 
          initialResponse: toolResponseText, // Send the initial text part back
          toolResults: (toolResults || []).map((tr: any) => { 
            const toolName = tr.toolName || 'unknown';
            // Extract text content safely
            const resultText = tr.result?.content?.[0]?.text ?? JSON.stringify(tr.result); 
            return {
              name: toolName,
              result: resultText
            };
          }),
          // Use the final response text generated after tool calls
          finalResponse: finalAssistantResponseText ?? (toolResults && toolResults.length > 0 ? null : toolResponseText)
      });

    } catch (error) {
      console.error('Error processing chat request:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  })();
});

app.get('/api/tools', (req: Request, res: Response) => {
  (async () => {
    try {
      // Force refresh of the tools list from the host
      const toolList = await host.toolList();
      console.log("[Server] API returning tools:", toolList);
      res.json({ tools: toolList });
    } catch (error) {
      console.error('Error fetching tools:', error);
      res.status(500).json({ error: 'Failed to fetch tools' });
    }
  })();
});

// Start server
initializeHost().then(() => {
  app.listen(port, () => {
    console.log(`[Server] API server running on port ${port}`);
  });
}).catch(err => {
  console.error('[Server] Failed to initialize MCP host:', err);
  // Start the server anyway with whatever tools were loaded successfully
  app.listen(port, () => {
    console.log(`[Server] API server running on port ${port} with limited functionality`);
  });
});
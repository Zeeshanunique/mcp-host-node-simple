import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MCPHost } from '../mcp-host.js';
import { LLMClient } from '../llm-client.js';
import { AnthropicProvider } from '../llm-provider.js';

const app = express();
const port = process.env.PORT || 3001;

// Initialize MCP host
const host = new MCPHost();
let tools: Record<string, any> = {};

// Middleware
app.use(cors());
app.use(express.json());

// Initialize MCP host and tools
async function initializeHost() {
  await host.start({
    mcpServerConfig: "./mcp-servers.json",
  });
  tools = await host.tools();
  console.log("[Server] MCP Host initialized with tools:", await host.toolList());
}

// API endpoints - Use proper route method typing
app.post('/api/chat', (req: Request, res: Response) => {
  (async () => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const llm = new LLMClient({ provider: new AnthropicProvider() });
      llm.append("user", message);

      const { toolResults, text: toolResponse } = await llm.generate({
        tools
      });

      // Add tool outputs to the conversation if any
      if (toolResults && toolResults.length > 0) {
        for (const toolResult of toolResults) {
          // Safe access to tool result properties
          const toolName = (toolResult as any).toolName || 'unknown';
          const resultContent = (toolResult as any).result?.content;
          
          if (resultContent && resultContent[0]?.text) {
            llm.append("user", resultContent[0].text);
          }
        }
        
        // Generate final response
        const { text: assistantResponse } = await llm.generate();
        
        return res.json({ 
          initialResponse: toolResponse,
          toolResults: toolResults.map((tr) => {
            const toolName = (tr as any).toolName || 'unknown';
            const resultText = (tr as any).result?.content?.[0]?.text || 'No result';
            
            return {
              name: toolName,
              result: resultText
            };
          }),
          finalResponse: assistantResponse
        });
      } else {
        // If no tools were used
        return res.json({ 
          initialResponse: toolResponse,
          toolResults: [],
          finalResponse: null
        });
      }
    } catch (error) {
      console.error('Error processing chat request:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  })();
});

app.get('/api/tools', (req: Request, res: Response) => {
  (async () => {
    try {
      const toolList = await host.toolList();
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
  process.exit(1);
});
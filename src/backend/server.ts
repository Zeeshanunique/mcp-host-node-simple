import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MCPHost } from '../mcp-host.js';
import { LLMClient } from '../llm-client.js';
import { AnthropicProvider } from '../llm-provider.js';
import { CoreMessage } from 'ai';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../utils/logger.js';

// Get directory paths for proper file resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.info('[Server] Initializing Express...');
const app = express();
const port = config.BACKEND_PORT || config.PORT; // Use BACKEND_PORT, fall back to PORT for compatibility

// Define error handler middleware
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, 'Server error');
  res.status(500).json({ error: 'Internal server error', message: config.NODE_ENV === 'production' ? null : err.message });
};

// Initialize MCP host
logger.info('[Server] Initializing MCPHost...');
const host = new MCPHost();
let tools: Record<string, any> = {};

// Apply middleware
logger.info('[Server] Applying middleware...');

// Security middleware
const corsOptions = {
  origin: config.CORS_ORIGINS === '*' ? '*' : config.CORS_ORIGINS.split(','),
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Limit payload size

// Add request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  logger.debug({ path: req.path, method: req.method, ip: req.ip, reqId: (req as any).reqId }, 'Incoming request');
  next();
});

logger.info('[Server] Middleware applied.');

// Initialize MCP host and tools
async function initializeHost() {
  try {
    // Resolve the MCP config path from the configuration
    const mcpConfigPath = path.resolve(process.cwd(), config.MCP_CONFIG_PATH);
    logger.info({ configPath: mcpConfigPath }, "[Server] Loading MCP config");

    await host.start({
      mcpServerConfig: mcpConfigPath,
    });
    
    tools = await host.tools();
    const toolList = await host.toolList();
    logger.info({ tools: toolList }, "[Server] MCP Host initialized with tools");
  } catch (error) {
    logger.error({ error }, "[Server] Error initializing MCP host");
    
    // Continue with whatever tools were loaded successfully
    tools = await host.tools();
    const availableTools = await host.toolList();
    logger.info({ tools: availableTools }, "[Server] Continuing with available tools");
  }
}

// API endpoints - Use proper route method typing
// API endpoint for chat requests
app.post('/api/chat', (req: Request, res: Response, next: NextFunction) => {
  (async () => {
  try {
    // Extract and validate history from the request body
    const { history } = req.body as { history: CoreMessage[] }; 
    
    if (!history || !Array.isArray(history) || history.length === 0) {
      logger.warn({ reqId: (req as any).reqId }, 'Invalid chat request: empty or missing history');
      return res.status(400).json({ error: 'History is required and must be a non-empty array' });
    }

    // Get the last user message from the history
    const lastMessage = history[history.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      logger.warn({ reqId: (req as any).reqId }, 'Invalid chat request: last message is not from user');
      return res.status(400).json({ error: 'Last message in history must be from the user' });
    }
    
    logger.info({ 
      reqId: (req as any).reqId,
      messageCount: history.length,
      lastUserMessage: typeof lastMessage.content === 'string' ? lastMessage.content.substring(0, 50) : '[complex content]'
    }, 'Processing chat request');
    
    // Initialize the LLM client with the provided history
    const llm = new LLMClient({
      provider: new AnthropicProvider(),
      initialMessages: history 
    });
    
    // Generate initial response with tools
    const initialGenerationResult = await llm.generate({ tools });
    
    const toolResponseText = initialGenerationResult.text;
    const toolResults = initialGenerationResult.toolResults;
    const assistantMessage = initialGenerationResult.response.messages.find(m => m.role === 'assistant');

    logger.debug({ 
      reqId: (req as any).reqId,
      hasToolResults: !!toolResults?.length,
      toolsUsed: toolResults?.map((tr: any) => tr.toolName || 'unknown')
    }, 'Initial generation complete');

    let finalAssistantResponseText: string | null = null;

    // If tools were used, process them and generate a final response
    if (toolResults && toolResults.length > 0) {
        // Append the assistant message with tool calls
        if (assistantMessage) {
          llm.append('assistant', assistantMessage.content);
        } else {
          logger.warn({ reqId: (req as any).reqId }, 'Could not find assistant message with tool calls');
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
          
          logger.debug({ 
            reqId: (req as any).reqId, 
            toolName: (toolResult as any).toolName || 'unknown',
            toolCallId
          }, 'Added tool result');
        }
        
        // Generate the final response after adding tool results
        logger.debug({ reqId: (req as any).reqId }, 'Generating final response after tools');
        const finalGenerationResult = await llm.generate();
        finalAssistantResponseText = finalGenerationResult.text;
    }
    
    // Prepare and return the response payload
    const response = { 
      initialResponse: toolResponseText,
      toolResults: (toolResults || []).map((tr: any) => { 
        const toolName = tr.toolName || 'unknown';
        const resultText = tr.result?.content?.[0]?.text ?? JSON.stringify(tr.result); 
        return {
          name: toolName,
          result: resultText
        };
      }),
      finalResponse: finalAssistantResponseText ?? (toolResults && toolResults.length > 0 ? null : toolResponseText)
    };
    
    logger.info({ reqId: (req as any).reqId, toolCount: response.toolResults.length }, 'Chat request completed successfully');
    return res.json(response);
    
  } catch (error) {
    logger.error({ error, reqId: (req as any).reqId }, 'Error processing chat request');
    res.status(500).json({ error: 'Failed to process request' });
  }
  })();
});

// API endpoint for fetching available tools
app.get('/api/tools', (req: Request, res: Response) => {
  (async () => {
  try {
    // Fetch the current tool list from the host
    const toolList = await host.toolList();
    logger.debug({ tools: toolList, reqId: (req as any).reqId }, 'Returning tools list');
    res.json({ tools: toolList });
  } catch (error) {
    logger.error({ error, reqId: (req as any).reqId }, 'Error fetching tools');
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
  })();
});

// Add health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', environment: config.NODE_ENV });
});

// Serve frontend in production mode
if (config.NODE_ENV === 'production') {
  const frontendBuildPath = path.resolve(__dirname, '../../src/frontend/build');
  
  if (fs.existsSync(frontendBuildPath)) {
    logger.info({ path: frontendBuildPath }, 'Serving frontend static files');
    // Serve static files from the React build
    app.use(express.static(frontendBuildPath));
    
    // Simple route for serving index.html, instead of complex wildcard route
    app.use((req: Request, res: Response) => {
      res.sendFile(path.resolve(frontendBuildPath, 'index.html'));
    });
  } else {
    logger.warn({ path: frontendBuildPath }, 'Frontend build directory not found');
  }
}

// Apply error handler as the last middleware
app.use(errorHandler);

// Start server
initializeHost().then(() => {
  app.listen(port, () => {
    logger.info(`[Server] API server running on port ${port} in ${config.NODE_ENV} mode`);
  });
}).catch(err => {
  logger.error({ err }, '[Server] Failed to initialize MCP host');
  
  // Start the server anyway with whatever tools were loaded successfully
  app.listen(port, () => {
    logger.warn(`[Server] API server running on port ${port} with limited functionality`);
  });
});

// Handle application shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Implement any cleanup needed here
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  // Implement any cleanup needed here
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception, shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection, shutting down');
  process.exit(1);
});

// Export app for testing
export default app;
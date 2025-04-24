import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MCPHost } from '../mcp-host.js';
import { LLMClient } from '../llm-client.js';
import { AnthropicProvider, OpenAIProvider, AzureOpenAIProvider } from '../llm-provider.js';
import { getProviderInstance, setProvider, getCurrentProvider, getAvailableProviders } from '../providers.js';
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

// API endpoint for selecting the LLM provider
app.post('/api/provider', (req: Request, res: Response) => {
  (async () => {
  try {
    const { provider } = req.body;
    
    if (!provider || (provider !== 'anthropic' && provider !== 'openai' && provider !== 'bedrock' && provider !== 'azure')) {
      return res.status(400).json({ 
        error: 'Invalid provider specified', 
        message: 'Provider must be either "anthropic", "openai", "bedrock", or "azure"' 
      });
    }
    
    const success = setProvider(provider);
    if (!success) {
      return res.status(400).json({ error: 'Failed to set provider' });
    }
    
    logger.info({ provider }, '[Server] Provider changed');
    
    return res.status(200).json({ 
      success: true, 
      provider: getCurrentProvider(),
      message: `Provider changed to ${getCurrentProvider()}`
    });
  } catch (error) {
    logger.error({ error }, 'Error changing provider');
    return res.status(500).json({ error: 'Failed to change provider' });
  }
  })();
});

// API endpoint to get current provider
app.get('/api/provider', (_req: Request, res: Response) => {
  res.status(200).json({ 
    provider: getCurrentProvider(),
    availableProviders: getAvailableProviders()
  });
});

// API endpoint for chat requests
app.post('/api/chat', (req: Request, res: Response, next: NextFunction) => {
  (async () => {
  try {
    // Extract and validate history from the request body
    const { history, provider } = req.body as { history: CoreMessage[], provider?: 'anthropic' | 'openai' | 'bedrock' | 'azure' };
    
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
    
    // Use the provider from the request if specified, otherwise use the current default
    if (provider) {
      // Temporarily set the provider for this request if specified
      setProvider(provider);
    }
    
    // Initialize the LLM client with the provided history
    const llm = new LLMClient({
      provider: getProviderInstance(),
      initialMessages: history 
    });
    
    // Load MCP tools directly from the host
    const mcpTools = await host.tools();
    logger.info({ 
      reqId: (req as any).reqId,
      toolCount: Object.keys(mcpTools).length,
      toolList: await host.toolList(),
      provider: getCurrentProvider()
    }, 'Loaded MCP tools for request');
    
    // ========== MULTI-STEP EXECUTION LOOP ==========
    let toolResponseText = '';
    let allToolResults: any[] = [];
    let continueToolExecution = true;
    let loopCount = 0;
    const MAX_ITERATIONS = 5; // Prevent infinite loops

    // Add initial system message to guide the entire conversation
    llm.append('user', `For queries requiring external data or specific operations, use the appropriate tools. 
For multi-part queries, make sure to use all necessary tools to gather complete information.
Always treat tool results as real data for analysis purposes, even if they're noted as simulated.
After gathering all information, provide a comprehensive final answer that synthesizes all the tool results.`);

    while (continueToolExecution && loopCount < MAX_ITERATIONS) {
      loopCount++;
      logger.info({ reqId: (req as any).reqId, iteration: loopCount }, 'Starting tool execution iteration');
      
      // Generate response with tools to let the LLM decide what tools to use next
      const generationResult = await llm.generate({ 
        tools: mcpTools,
        temperature: 0.2, // Lower temperature for tool selection to be more precise
      });
      
      // Capture the assistant's thinking/reasoning
      const assistantMessage = generationResult.response.messages.find(m => m.role === 'assistant');
      if (assistantMessage) {
        if (loopCount === 1) {
          // Store initial response only the first time
          toolResponseText = generationResult.text;
        }
        
        // Always add the assistant reasoning to conversation history
        llm.append('assistant', assistantMessage.content);
        logger.debug({ 
          reqId: (req as any).reqId, 
          messageLength: typeof generationResult.text === 'string' ? generationResult.text.length : 0
        }, 'Added assistant reasoning to conversation');
      }
      
      // Check if any tools were identified for execution
      const currentToolResults = generationResult.toolResults || [];
      
      if (currentToolResults.length === 0) {
        // No more tools to execute, exit the loop
        logger.info({ reqId: (req as any).reqId }, 'No more tools to execute, ending loop');
        continueToolExecution = false;
        continue;
      }
      
      logger.info({ 
        reqId: (req as any).reqId, 
        toolCount: currentToolResults.length,
        toolNames: currentToolResults.map((tr: any) => tr.toolName || 'unknown')
      }, 'Tools identified for execution');
      
      // Process tool results and add to conversation history
      for (let i = 0; i < currentToolResults.length; i++) {
        const toolResult = currentToolResults[i];
        const toolCallId = (toolResult as any).toolCallId || `tool_${Date.now()}_${loopCount}_${i}`;
        const toolName = (toolResult as any).toolName || 'unknown';
        const toolResultContent = (toolResult as any).result?.content;
        const resultText = Array.isArray(toolResultContent) && toolResultContent[0]?.text
                         ? toolResultContent[0].text
                         : JSON.stringify((toolResult as any).result);
        
        // Add global sequence numbers across all loop iterations
        const sequenceNum = allToolResults.length + 1;
        
        // Add tool result to conversation context
        llm.append('tool', {
          type: 'tool-result',
          toolCallId: toolCallId,
          toolName: toolName,
          result: resultText
        });
        
        // Add to our master list of tools with proper type casting
        allToolResults.push({
          toolName,
          toolCallId,
          sequence: sequenceNum,
          result: {
            content: Array.isArray(toolResultContent) ? toolResultContent : [{ text: resultText }]
          }
        });
        
        logger.debug({ 
          reqId: (req as any).reqId, 
          toolName,
          toolCallId,
          sequence: sequenceNum,
          totalSoFar: allToolResults.length
        }, 'Added tool result to conversation');
      }
    }
    
    // Generate the final response after all tools have been executed
    logger.debug({ reqId: (req as any).reqId }, 'Generating final response after all tools');

    // Instead of adding another system message, add a user message asking for a summary
    llm.append('user', `I need a complete summary of all the information gathered from the ${allToolResults.length} tool${allToolResults.length !== 1 ? 's' : ''} above. Please synthesize all the data into a comprehensive answer to my original question.`);

    // Generate the final response with parameters to encourage comprehensive answers
    const finalGenerationResult = await llm.generate({
      temperature: 0.7, // Slightly higher temperature for more comprehensive responses
      maxTokens: 4000, // Allow longer responses for better synthesis
      // No tools passed here so the model focuses on synthesis
    });
    const finalAssistantResponseText = finalGenerationResult.text;
    
    // Prepare and return the response payload with all accumulated tool results
    const response = { 
      initialResponse: toolResponseText,
      toolResults: allToolResults.map((tr: any) => { 
        const toolName = tr.toolName || 'unknown';
        const resultContent = tr.result?.content;
        const resultText = Array.isArray(resultContent) && resultContent[0]?.text
                         ? resultContent[0].text
                         : JSON.stringify(tr.result); 
        return {
          name: toolName,
          result: resultText,
          sequence: tr.sequence,
          totalSteps: allToolResults.length
        };
      }),
      finalResponse: finalAssistantResponseText
    };
    
    logger.info({ 
      reqId: (req as any).reqId, 
      toolCount: response.toolResults.length,
      loopCount
    }, 'Chat request completed successfully');
    
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
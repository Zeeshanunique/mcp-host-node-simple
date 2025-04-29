import express, { Request, Response, NextFunction, Application, RequestHandler } from 'express';
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
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import http from 'http';

// Get directory paths for proper file resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.info('[Server] Initializing Express...');
const app = express();
const port = config.BACKEND_PORT || config.PORT; // Use BACKEND_PORT, fall back to PORT for compatibility
let server: http.Server;

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

// Add security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...(config.CORS_ORIGINS === '*' ? ['*'] : config.CORS_ORIGINS.split(','))],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
    }
  }
}));

// Add compression
app.use(compression());

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Limit payload size

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS || 60 * 1000, // 1 minute by default
  max: config.RATE_LIMIT_MAX_REQUESTS || 30, // 30 requests per minute by default
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (_req) => process.env.NODE_ENV === 'development' // Skip in development
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Add request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as any).reqId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  logger.debug({ path: req.path, method: req.method, ip: req.ip, reqId: (req as any).reqId }, 'Incoming request');
  next();
});

// Serve static files from frontend build in production
if (config.NODE_ENV === 'production') {
  // Use process.cwd() to get the absolute path from the current working directory
  const frontendBuildPath = path.resolve(process.cwd(), 'src/frontend/build');
  
  logger.info({ path: frontendBuildPath, exists: fs.existsSync(frontendBuildPath) }, '[Server] Frontend build path');
  
  if (fs.existsSync(frontendBuildPath)) {
    logger.info({ path: frontendBuildPath }, '[Server] Serving static files from frontend build');
    
    // Serve static files with appropriate caching headers
    app.use(express.static(frontendBuildPath, {
      maxAge: '1d', // Cache static assets for 1 day
      etag: true,
      lastModified: true
    }));
    
    // Add catch-all route for SPA - this will serve index.html for any unmatched routes
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (!req.path.startsWith('/api/')) {
        const indexPath = path.join(frontendBuildPath, 'index.html');
        logger.info({ path: req.path, indexPath, exists: fs.existsSync(indexPath) }, '[Server] Serving SPA index.html');
        
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          logger.error({ indexPath }, '[Server] index.html not found');
          res.status(404).send('Frontend not built properly. index.html not found.');
        }
      } else {
        next();
      }
    });
  } else {
    logger.warn({ path: frontendBuildPath }, '[Server] Frontend build directory not found');
    // Fallback route to inform about missing frontend
    app.get('/', (_req: Request, res: Response) => {
      res.status(404).send('Frontend build not found. Please run npm run build:frontend first.');
    });
  }
}

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

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    memory: process.memoryUsage(),
    toolsCount: Object.keys(tools).length,
    version: process.env.npm_package_version
  };
  
  // Check if MCP host is running properly
  if (Object.keys(tools).length === 0) {
    healthData.status = 'degraded';
  }
  
  const statusCode = healthData.status === 'ok' ? 200 : 500;
  res.status(statusCode).json(healthData);
});

// Add detailed readiness probe
const readyHandler: RequestHandler = async (_req, res) => {
  try {
    // Check MCP tools are available
    const toolList = await host.toolList();
    if (toolList.length === 0) {
      res.status(503).json({ status: 'not_ready', reason: 'mcp_tools_unavailable' });
      return;
    }
    
    res.status(200).json({ status: 'ready', toolsAvailable: toolList.length });
  } catch (error) {
    logger.error({ error }, 'Readiness check failed');
    res.status(503).json({ status: 'not_ready', reason: 'error_checking_readiness' });
  }
};

app.get('/ready', readyHandler);

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
    
    // Log the provider being used
    const currentProviderName = getCurrentProvider();
    logger.info({ reqId: (req as any).reqId, provider: currentProviderName }, 'Using LLM provider');
    
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
    
    // For Azure provider, ensure we have proper responses even if empty
    // This is the fix for the Azure provider issue
    let initialResponseText = toolResponseText;
    let finalResponseTextForFrontend = finalAssistantResponseText;
    
    // Special handling for Azure provider to ensure we have content to display in the frontend
    if (currentProviderName === 'azure') {
      // Log the current state of the responses
      logger.info({ 
        reqId: (req as any).reqId, 
        provider: currentProviderName,
        hasInitialResponse: !!initialResponseText && initialResponseText.trim() !== '',
        hasFinalResponse: !!finalAssistantResponseText && finalAssistantResponseText.trim() !== '',
        toolResultsCount: allToolResults.length
      }, 'Azure response state before formatting');
      
      // Case 1: No initial response but we have tool results - provide context
      if ((!initialResponseText || initialResponseText.trim() === '') && allToolResults.length > 0) {
        initialResponseText = `Azure OpenAI is working with tools to process your request: "${lastMessage.content}"`;
      }
      // Case 2: No initial response and no tool results, but we have a final response
      else if ((!initialResponseText || initialResponseText.trim() === '') && 
               (finalAssistantResponseText && finalAssistantResponseText.trim() !== '')) {
        initialResponseText = `Processing your request: "${lastMessage.content}"`;
      }
      // Case 3: No initial response, no tool results, no final response
      else if ((!initialResponseText || initialResponseText.trim() === '') && 
               (!finalAssistantResponseText || finalAssistantResponseText.trim() === '')) {
        initialResponseText = `Azure OpenAI is processing your request: "${lastMessage.content}"`;
        finalResponseTextForFrontend = "Azure OpenAI has processed your request, but no textual response was generated. This can happen when using tools or with certain types of queries. Please try a different question or check the tool results if available.";
      }
      
      logger.info({ 
        reqId: (req as any).reqId, 
        provider: currentProviderName,
        initialResponseUpdated: initialResponseText !== toolResponseText,
        finalResponseUpdated: finalResponseTextForFrontend !== finalAssistantResponseText
      }, 'Applied Azure-specific response formatting');
    }
    
    // Prepare and return the response payload with all accumulated tool results
    const response = { 
      initialResponse: initialResponseText,
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
      finalResponse: finalResponseTextForFrontend
    };
    
    logger.info({ 
      reqId: (req as any).reqId, 
      toolCount: response.toolResults.length,
      loopCount,
      hasInitialResponse: !!response.initialResponse,
      hasFinalResponse: !!response.finalResponse
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

// API endpoint for getting servers with their associated tools
app.get('/api/servers', (req: Request, res: Response) => {
  (async () => {
  try {
    const mcpConfigPath = path.resolve(process.cwd(), config.MCP_CONFIG_PATH);
    // Read the server configuration file directly
    const configContent = await fs.promises.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(configContent);
    
    // Get the map of tools grouped by server
    const toolList = await host.toolList();
    const serverMap: Record<string, string[]> = {};
    
    // Initialize servers from config
    if (mcpConfig.mcpServers) {
      Object.keys(mcpConfig.mcpServers).forEach(serverName => {
        serverMap[serverName] = [];
      });
    }
    
    // Group tools by server using the host's internal categorization
    // If available in your implementation
    try {
      // Use the enhancedTools method if it exists to get server information
      const enhancedTools = await host.toolsWithMetadata();
      
      // Process enhanced tools with metadata
      for (const [toolName, toolInfo] of Object.entries(enhancedTools)) {
        const serverName = (toolInfo as any).metadata?.serverName || 'unknown';
        if (!serverMap[serverName]) {
          serverMap[serverName] = [];
        }
        serverMap[serverName].push(toolName);
      }
    } catch (error) {
      // If the metadata approach failed, use a fallback approach with name-based matching
      logger.warn({ error, reqId: (req as any).reqId }, 'Using fallback server grouping method');
      
      // Fallback: group by tool name prefixes
      for (const toolName of toolList) {
        let assigned = false;
        
        // Try to match the tool name to a server name
        for (const serverName of Object.keys(serverMap)) {
          if (toolName === serverName || 
              toolName.startsWith(`${serverName}_`) || 
              toolName.includes(serverName)) {
            serverMap[serverName].push(toolName);
            assigned = true;
            break;
          }
        }
        
        // If no match found, put in "other" category
        if (!assigned) {
          if (!serverMap['other']) {
            serverMap['other'] = [];
          }
          serverMap['other'].push(toolName);
        }
      }
    }
    
    // Remove empty servers
    Object.keys(serverMap).forEach(server => {
      if (serverMap[server].length === 0) {
        delete serverMap[server];
      }
    });
    
    logger.debug({ servers: Object.keys(serverMap), reqId: (req as any).reqId }, 'Returning servers with tools');
    res.json({ servers: serverMap });
  } catch (error) {
    logger.error({ error, reqId: (req as any).reqId }, 'Error fetching servers');
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
  })();
});

// Graceful shutdown function
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, '[Server] Received shutdown signal');
  
  if (server) {
    logger.info('[Server] Closing HTTP server');
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
  
  logger.info('[Server] Shutting down MCP tools');
  try {
    await host.shutdown();
    logger.info('[Server] Shutdown complete');
  } catch (err) {
    logger.error({ err }, '[Server] Error during MCP shutdown');
  }
  
  process.exit(0);
};

// Only start the server if not being imported as a module
// This allows for serverless deployment
if (process.env.VERCEL !== '1') {
  // Initialize the host when starting the server directly
  initializeHost().then(() => {
    server = app.listen(port, () => {
      logger.info({ port }, '[Server] Express server listening on port');
    });
    
    // Enable keep-alive and proper connection handling
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // 66 seconds
  }).catch(err => {
    logger.error({ err }, '[Server] Error initializing host');
    process.exit(1);
  });
  
  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
} else {
  // When running on Vercel, initialize on first request
  app.use(async (req: Request, _res: Response, next: NextFunction) => {
    if (!Object.keys(tools).length) {
      try {
        await initializeHost();
      } catch (error) {
        logger.error({ error }, '[Server] Error initializing host on first request');
      }
    }
    next();
  });
}

// Add error handler middleware
app.use(errorHandler);

// Export the app for serverless usage
export { app };
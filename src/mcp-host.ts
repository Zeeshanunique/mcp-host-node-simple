import path from 'node:path';
import { readMCPTransport } from './mcp-transport.js';
import { experimental_createMCPClient } from 'ai';
import logger from './utils/logger.js';
import { type Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

export type MCPHostOptions = {
  mcpServerConfig: string;
};

export type MCPClient = Awaited<
  ReturnType<typeof experimental_createMCPClient>
>;

// Define the transport types needed for the client
export type MCPClientTransport = Experimental_StdioMCPTransport | { type: string; url: string };

// Add tool context tracking
export type ToolContext = {
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
};

// Add session-specific tool context tracking
export type SessionToolContext = {
  [sessionId: string]: {
    toolStates: Record<string, any>;
    lastUsed: Record<string, number>;
    successfulCalls: Record<string, number>;
    failedCalls: Record<string, number>;
  }
};

export class MCPHost {
  #tools: Record<string, any>;
  #childProcesses: Record<string, any>;
  #serverToolMap: Record<string, string[]>;
  #initialDiscovery: Record<string, string[]>;
  #sessionToolContext: SessionToolContext;
  #currentContext?: ToolContext;

  constructor() {
    this.#tools = {};
    this.#childProcesses = {};
    this.#serverToolMap = {};
    this.#initialDiscovery = {};
    this.#sessionToolContext = {};
  }

  async start(options: MCPHostOptions) {
    logger.info('[MCPHost] Host get started');

    const configPath = path.resolve(process.cwd(), options.mcpServerConfig);
    logger.info({ configPath }, '[MCPHost] Reading config from');
    
    const transports = await readMCPTransport(configPath);
    logger.info({ servers: Object.keys(transports) }, '[MCPHost] Configured servers');

    // Create clients for each server, handling errors individually
    const clients: MCPClient[] = [];
    for (const [name, transport] of Object.entries(transports)) {
      try {
        logger.info({ name }, '[MCPHost] Creating client for server');
        const client = await experimental_createMCPClient({ transport });
        
        // Store reference to child process if available
        if ((transport as any).process) {
          this.#childProcesses[name] = (transport as any).process;
          logger.debug({ name, pid: (transport as any).process.pid }, '[MCPHost] Tracking child process');
          
          // Initialize server in the tool map
          this.#serverToolMap[name] = [];
          this.#initialDiscovery[name] = [];
        }
        
        clients.push(client);
        logger.info({ name }, '[MCPHost] Successfully created client for server');
      } catch (err) {
        logger.error({ err, name }, '[MCPHost] Error creating client');
        // Continue with other servers
      }
    }

    logger.info({ count: clients.length }, '[MCPHost] Created clients successfully');

    // Load tools from each client, handling errors individually
    let clientIndex = 0;
    for (const client of clients) {
      try {
        logger.debug('[MCPHost] Getting tools from client...');
        const tools = await client.tools();
        logger.info({ tools: Object.keys(tools) }, '[MCPHost] Got tools');

        // Find which server this client corresponds to
        const serverName = this.findServerNameByIndex(clientIndex, Object.keys(transports));
        if (serverName) {
          // Track the tools that come from this server
          this.#initialDiscovery[serverName] = Object.keys(tools);
          
          // Also update the server-tool map
          if (!this.#serverToolMap[serverName]) {
            this.#serverToolMap[serverName] = [];
          }
        }

        for (const [name, tool] of Object.entries(tools)) {
          logger.debug({ name }, '[MCPHost] Adding tool');
          
          // Wrap the tool to support session context
          this.#tools[name] = this.#wrapToolWithContext(name, tool);
          
          // Map tool to server if we know which server it came from
          if (serverName) {
            this.#serverToolMap[serverName].push(name);
          }
        }
        
        clientIndex++;
      } catch (err) {
        logger.error({ err }, '[MCPHost] Error getting tools from client');
        clientIndex++;
        // Continue with other clients
      }
    }

    const toolsValid = await this.validateTools();
    logger.info({ valid: toolsValid }, '[MCPHost] Tool validation');
    logger.info({ tools: await this.toolList() }, '[MCPHost] Host started with');
    
    // Log the server-tool mapping
    logger.info({ 
      serverCount: Object.keys(this.#serverToolMap).length,
      mapping: this.#serverToolMap 
    }, '[MCPHost] Server-tool mapping established');
  }
  
  /**
   * Wrap a tool function with session context awareness
   */
  #wrapToolWithContext(toolName: string, originalTool: any): any {
    // Create a wrapped function that preserves the original tool's properties
    const wrappedTool = async (...args: any[]) => {
      try {
        const context = this.#currentContext;
        const sessionId = context?.sessionId;
        
        // Initialize session tool context if it doesn't exist
        if (sessionId && !this.#sessionToolContext[sessionId]) {
          this.#sessionToolContext[sessionId] = {
            toolStates: {},
            lastUsed: {},
            successfulCalls: {},
            failedCalls: {}
          };
        }
        
        // Track tool usage for this session
        if (sessionId) {
          this.#sessionToolContext[sessionId].lastUsed[toolName] = Date.now();
          
          // Initialize counters if they don't exist
          if (!this.#sessionToolContext[sessionId].successfulCalls[toolName]) {
            this.#sessionToolContext[sessionId].successfulCalls[toolName] = 0;
          }
          if (!this.#sessionToolContext[sessionId].failedCalls[toolName]) {
            this.#sessionToolContext[sessionId].failedCalls[toolName] = 0;
          }
        }
        
        logger.info({ 
          toolName, 
          sessionId: context?.sessionId, 
          userId: context?.userId 
        }, '[MCPHost] Executing tool with context');
        
        // Call the original tool function
        const result = await originalTool(...args);
        
        // Update success counter
        if (sessionId) {
          this.#sessionToolContext[sessionId].successfulCalls[toolName]++;
          
          // Store any tool state if needed
          if (result && typeof result === 'object' && result.state) {
            this.#sessionToolContext[sessionId].toolStates[toolName] = result.state;
          }
        }
        
        return result;
      } catch (error) {
        // Track failures
        const sessionId = this.#currentContext?.sessionId;
        if (sessionId && this.#sessionToolContext[sessionId]) {
          this.#sessionToolContext[sessionId].failedCalls[toolName]++;
        }
        
        logger.error({ 
          error, 
          toolName, 
          sessionId
        }, '[MCPHost] Tool execution failed');
        
        throw error;
      }
    };
    
    // Copy all properties from the original tool to preserve metadata
    Object.assign(wrappedTool, originalTool);
    
    return wrappedTool;
  }
  
  /**
   * Set the current context for tool execution
   */
  setContext(context: ToolContext): void {
    this.#currentContext = context;
    logger.debug({ context }, '[MCPHost] Set current context');
  }
  
  /**
   * Clear the current context
   */
  clearContext(): void {
    this.#currentContext = undefined;
    logger.debug('[MCPHost] Cleared current context');
  }
  
  /**
   * Get tool context for a specific session
   */
  getSessionToolContext(sessionId: string): Record<string, any> | null {
    if (!this.#sessionToolContext[sessionId]) {
      return null;
    }
    
    return this.#sessionToolContext[sessionId];
  }
  
  /**
   * Get tool usage statistics for a session
   */
  getToolUsageStats(sessionId: string): { 
    toolUsage: Record<string, { 
      lastUsed: number, 
      successCount: number, 
      failCount: number 
    }>,
    mostUsedTools: string[],
    recentlyUsedTools: string[]
  } | null {
    if (!this.#sessionToolContext[sessionId]) {
      return null;
    }
    
    const sessionContext = this.#sessionToolContext[sessionId];
    const toolUsage: Record<string, any> = {};
    
    // Compile usage statistics
    for (const toolName of Object.keys(sessionContext.lastUsed)) {
      toolUsage[toolName] = {
        lastUsed: sessionContext.lastUsed[toolName],
        successCount: sessionContext.successfulCalls[toolName] || 0,
        failCount: sessionContext.failedCalls[toolName] || 0
      };
    }
    
    // Get most used tools (by success count)
    const mostUsedTools = Object.entries(sessionContext.successfulCalls || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([toolName]) => toolName);
    
    // Get recently used tools
    const recentlyUsedTools = Object.entries(sessionContext.lastUsed || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([toolName]) => toolName);
    
    return {
      toolUsage,
      mostUsedTools,
      recentlyUsedTools
    };
  }
  
  // Helper method to find which server name corresponds to a client by index
  private findServerNameByIndex(index: number, serverNames: string[]): string | null {
    if (index >= 0 && index < serverNames.length) {
      return serverNames[index];
    }
    return null;
  }
  
  // Get the server-tool mapping established during initialization
  async getServerToolMap(): Promise<Record<string, string[]>> {
    // If we have direct mappings from initialization, use them
    if (Object.keys(this.#serverToolMap).length > 0) {
      return { ...this.#serverToolMap };
    }
    
    // If no direct mappings are available, try to infer from tool names
    const inferredMap: Record<string, string[]> = {};
    const tools = await this.tools();
    const toolNames = Object.keys(tools);
    
    // Define known servers (retrieve from class member if available)
    const knownServers = Object.keys(this.#initialDiscovery).length > 0 
      ? Object.keys(this.#initialDiscovery)
      : [
          'websearch', 'research', 'weather', 'summarize', 'webscrap',
          'aws_docs', 'calculator', 'travel_guide', 'age_calculator', 
          'fastmcp_test', 'playwright', 'supabase', 'airbnb', 'github'
        ];
    
    // Initialize server entries
    for (const serverName of knownServers) {
      inferredMap[serverName] = [];
    }
    
    // Create regexps for more accurate matching
    const serverPatterns = knownServers.map(name => ({
      name,
      regex: new RegExp(`^${name}$|^${name}_|_${name}_|_${name}$|[.-]${name}$|^${name}[.-]`)
    }));
    
    // Map tools to servers
    for (const toolName of toolNames) {
      let assigned = false;
      
      // First try exact matches or strong pattern matches
      for (const { name, regex } of serverPatterns) {
        if (regex.test(toolName) || toolName.includes(name)) {
          inferredMap[name].push(toolName);
          assigned = true;
          break;
        }
      }
      
      // If still not assigned, use "other" category
      if (!assigned) {
        if (!inferredMap['other']) {
          inferredMap['other'] = [];
        }
        inferredMap['other'].push(toolName);
      }
    }
    
    // Remove empty servers
    Object.keys(inferredMap).forEach(server => {
      if (inferredMap[server].length === 0) {
        delete inferredMap[server];
      }
    });
    
    logger.info({ 
      serverCount: Object.keys(inferredMap).length,
      toolCount: Object.values(inferredMap).flat().length 
    }, '[MCPHost] Generated inferred server-tool mapping');
    
    return inferredMap;
  }
  
  // Get the initial discovery of tools by server during startup
  async getInitialServerToolDiscovery(): Promise<Record<string, string[]>> {
    return { ...this.#initialDiscovery };
  }

  async tools() {
    logger.debug({ count: Object.keys(this.#tools).length }, '[MCPHost] Returning configured tools');
    return this.#tools;
  }

  async toolList(): Promise<string[]> {
    const toolsObj = await this.tools();
    const toolNames = Object.keys(toolsObj);
    logger.debug({ tools: toolNames }, '[MCPHost] Available tools');
    return toolNames;
  }

  // Add validation method to verify tools are properly loaded
  async validateTools(): Promise<boolean> {
    const tools = await this.tools();
    const toolCount = Object.keys(tools).length;
    logger.debug({ count: toolCount }, '[MCPHost] Validating tools');
    
    if (toolCount === 0) {
      logger.warn('[MCPHost] No tools available - MCP functionality will be limited');
      return false;
    }
    
    // Verify each tool has the required properties
    let validTools = 0;
    for (const [name, tool] of Object.entries(tools)) {
      if (typeof tool === 'function' || (typeof tool === 'object' && tool !== null)) {
        validTools++;
      } else {
        logger.warn({ name, type: typeof tool }, '[MCPHost] Invalid tool');
      }
    }
    
    logger.info({ valid: validTools, total: toolCount }, '[MCPHost] Tool validation summary');
    return validTools > 0;
  }

  // Add method to get tools with metadata
  async toolsWithMetadata() {
    const toolsObj = await this.tools();
    const enhancedTools: Record<string, any> = {};
    
    // Create a map of tool to server name
    const toolToServerMap: Record<string, string> = {};
    
    // Iterate through child processes to map tools to their servers
    for (const [serverName, _process] of Object.entries(this.#childProcesses)) {
      try {
        // Attempt to get tools associated with this server name from the config
        for (const toolName of Object.keys(toolsObj)) {
          // Check if tool name matches or is related to server name
          if (
            toolName === serverName || 
            toolName.startsWith(`${serverName}_`) || 
            toolName.includes(serverName)
          ) {
            toolToServerMap[toolName] = serverName;
          }
        }
      } catch (error) {
        logger.warn({ error, serverName }, '[MCPHost] Error mapping tools to server');
      }
    }
    
    for (const [name, tool] of Object.entries(toolsObj)) {
      // Extract or generate metadata
      const metadata = {
        name,
        description: (tool as any).description || `Tool for ${name.replace(/_/g, ' ')} operations`,
        parameters: (tool as any).parameters || {},
        category: this.categorizeToolByName(name),
        // Add the server name to metadata if known
        serverName: toolToServerMap[name] || this.inferServerFromToolName(name) || 'other'
      };
      
      enhancedTools[name] = {
        ...tool,
        metadata
      };
    }
    
    return enhancedTools;
  }
  
  // Helper method to infer server name from tool name
  private inferServerFromToolName(toolName: string): string | null {
    // Define all known servers from mcp-servers.json
    const knownServers = [
      'websearch', 'research', 'weather', 'summarize', 'webscrap',
      'aws_docs', 'calculator', 'travel_guide', 'age_calculator', 
      'fastmcp_test', 'playwright', 'supabase', 'airbnb'
    ];
    
    // First check for exact matches or direct prefixes
    for (const server of knownServers) {
      if (
        toolName === server || 
        toolName.startsWith(`${server}_`) || 
        toolName.endsWith(`_${server}`)
      ) {
        return server;
      }
    }
    
    // Next try to find embedded server names with word boundaries
    for (const server of knownServers) {
      // Check for embedded server name with word boundaries (underscore, hyphen, dot)
      if (
        toolName.includes(`_${server}_`) || 
        toolName.includes(`-${server}-`) ||
        toolName.includes(`.${server}.`)
      ) {
        return server;
      }
    }
    
    // Finally, try for substring matches, using the longest matching server name
    let bestMatch: { server: string | null, length: number } = { server: null, length: 0 };
    
    for (const server of knownServers) {
      if (toolName.includes(server) && server.length > bestMatch.length) {
        bestMatch = { server, length: server.length };
      }
    }
    
    return bestMatch.server;
  }

  // Add timeout handling for subprocess tools
  async executeTool(toolName: string, args: any, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms: ${toolName}`));
      }, timeout);
      
      try {
        if (!this.#tools[toolName]) {
          throw new Error(`Tool not found: ${toolName}`);
        }
        
        const result = await this.#tools[toolName](args);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  // Add retry logic for MCP tools
  async executeWithRetry(toolName: string, args: any, options: any = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 500;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTool(toolName, args, options.timeout || 30000);
      } catch (error: unknown) {
        lastError = error;
        logger.warn({ 
          toolName, 
          attempt, 
          maxRetries, 
          error: error instanceof Error ? error.message : String(error)
        }, `Tool execution failed, retrying...`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }

  // Add method to shutdown resources
  async shutdown() {
    const processes = Object.values(this.#childProcesses);
    logger.info({ count: processes.length }, '[MCPHost] Shutting down child processes');
    
    const shutdownPromises = processes.map(process => {
      return new Promise(resolve => {
        if (!process || process.killed) {
          resolve(true);
          return;
        }
        
        // Try gentle SIGTERM first
        process.kill('SIGTERM');
        
        // Give process 2 seconds to terminate gracefully
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          resolve(true);
        }, 2000);
      });
    });
    
    await Promise.all(shutdownPromises);
    logger.info('[MCPHost] All child processes terminated');
    return true;
  }

  private categorizeToolByName(name: string): string {
    // Categorize tools for better organization and sequential usage
    if (name.includes('search') || name.includes('research') || name.includes('find')) {
      return 'information-gathering';
    }
    if (name.includes('analyze') || name.includes('process') || name.includes('summarize')) {
      return 'data-processing';
    }
    if (name.includes('create') || name.includes('generate') || name.includes('make')) {
      return 'content-generation';
    }
    if (name.includes('add') || name.includes('subtract') || name.includes('multiply') || name.includes('calculate')) {
      return 'calculation';
    }
    return 'utility';
  }
}

import path from 'node:path';
import { readMCPTransport } from './mcp-transport.js';
import { experimental_createMCPClient } from 'ai';
import logger from './utils/logger.js';

export type MCPHostOptions = {
  mcpServerConfig: string;
};

export type MCPClient = Awaited<
  ReturnType<typeof experimental_createMCPClient>
>;

export class MCPHost {
  #tools: Record<string, any>;
  #childProcesses: Record<string, any>;

  constructor() {
    this.#tools = {};
    this.#childProcesses = {};
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
    for (const client of clients) {
      try {
        logger.debug('[MCPHost] Getting tools from client...');
        const tools = await client.tools();
        logger.info({ tools: Object.keys(tools) }, '[MCPHost] Got tools');

        for (const [name, tool] of Object.entries(tools)) {
          logger.debug({ name }, '[MCPHost] Adding tool');
          this.#tools = {
            ...this.#tools,
            [name]: tool,
          };
        }
      } catch (err) {
        logger.error({ err }, '[MCPHost] Error getting tools from client');
        // Continue with other clients
      }
    }

    const toolsValid = await this.validateTools();
    logger.info({ valid: toolsValid }, '[MCPHost] Tool validation');
    logger.info({ tools: await this.toolList() }, '[MCPHost] Host started with');
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
    
    for (const [name, tool] of Object.entries(toolsObj)) {
      // Extract or generate metadata
      const metadata = {
        name,
        description: (tool as any).description || `Tool for ${name.replace(/_/g, ' ')} operations`,
        parameters: (tool as any).parameters || {},
        category: this.categorizeToolByName(name),
      };
      
      enhancedTools[name] = {
        ...tool,
        metadata
      };
    }
    
    return enhancedTools;
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

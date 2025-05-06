import {
  AnthropicProvider as AnthropicProviderType,
  createAnthropic,
} from '@ai-sdk/anthropic';
import {
  createOpenAI,
} from '@ai-sdk/openai';
import {
  createAmazonBedrock,
} from '@ai-sdk/amazon-bedrock';
import { LanguageModel, CoreMessage } from 'ai';
import { OpenAI } from 'openai';
import 'dotenv/config';

type BaseType<T> = T extends infer U ? U : never;

export type Provider = BaseType<AnthropicProviderType>;

export interface LLMProvider {
  name(): string;
  model(): LanguageModel;
}

export class AnthropicProvider implements LLMProvider {
  #providerName = 'Anthropic';
  #modelName = 'claude-3-5-sonnet-20241022';
  #model: LanguageModel;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not found in environment variables');
    }
    
    const provider = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.#model = provider(this.#modelName);
  }

  model(): LanguageModel {
    return this.#model;
  }

  name(): string {
    return `${this.#providerName}::${this.#modelName}`;
  }
}

/**
 * OpenAI provider implementation.
 * 
 * This provider is designed to work with OpenAI's API and replaces the Google provider.
 * It has better compatibility with MCP tool schemas than Google's implementation.
 */
export class OpenAIProvider implements LLMProvider {
  #providerName = 'OpenAI';
  #modelName = 'gpt-4o';
  #model: LanguageModel;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    
    const provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Create the model with default settings
    this.#model = provider(this.#modelName);
  }

  model(): LanguageModel {
    return this.#model;
  }

  name(): string {
    return `${this.#providerName}::${this.#modelName}`;
  }
}

/**
 * AWS Bedrock provider implementation for Anthropic Claude.
 * 
 * This provider allows using Anthropic's Claude models via AWS Bedrock.
 * It leverages AWS infrastructure and credentials, providing an alternative
 * to direct Anthropic API access.
 */
export class BedrockAnthropicProvider implements LLMProvider {
  #providerName = 'BedrockAnthropic';
  #modelName = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  #model: LanguageModel;
  
  constructor() {
    try {
      console.log('[BedrockAnthropicProvider] Initializing AWS Bedrock Claude 3.5');
      
      // Create a standard Bedrock provider using the AI SDK
      const bedrockProvider = createAmazonBedrock({
        region: process.env.AWS_REGION || 'us-east-1'
      });

      // Get the base Bedrock model
      const baseModel = bedrockProvider(this.#modelName);
      
      // Create a wrapper that adds the required anthropicOptions
      this.#model = {
        ...baseModel,
        doGenerate: async (options: any) => {
          try {
            console.log('[BedrockAnthropicProvider] Received generation request');
            console.log('[BedrockAnthropicProvider] Tools provided in request:', 
                options.mode?.tools ? options.mode.tools.length : 0);
            
            // Deep clone options to avoid modifying the original
            const enhancedOptions = JSON.parse(JSON.stringify(options));
            
            // CRITICAL FIX: Always analyze the entire prompt for tool usage
            // even when tools aren't explicitly provided in this call
            if (!enhancedOptions.prompt) {
              enhancedOptions.prompt = [];
            }
            
            // Determine if the conversation has any tool usage
            const hasToolUsageInConversation = this.#hasAnyToolUsageInConversation(enhancedOptions.prompt);
            console.log('[BedrockAnthropicProvider] Tool usage in conversation history:', hasToolUsageInConversation);
            
            // ===== CRITICAL FIX: ALWAYS INCLUDE TOOL CONFIG IF TOOLS USED ANYWHERE =====
            // AWS Bedrock Claude 3.5 requires toolConfig whenever the conversation has ANY tool usage
            if (hasToolUsageInConversation || options.tools || options.mode?.tools) {
              // Get tools from options or create defaults based on conversation
              const tools = this.#prepareToolsForRequest(options);
              
              if (tools.length > 0) {
                // Create proper tool config structure
                enhancedOptions.anthropicOptions = {
                  ...enhancedOptions.anthropicOptions,
                  toolConfig: {
                    tools: tools,
                    toolChoice: options.toolChoice || options.mode?.toolChoice?.type || 'auto'
                  }
                };
                
                console.log('[BedrockAnthropicProvider] Added toolConfig with:', tools.length, 'tools');
              }
            }
            
            // Call the original model with enhanced options
            console.log('[BedrockAnthropicProvider] Sending request to AWS Bedrock...');
            const result = await baseModel.doGenerate(enhancedOptions);
            console.log('[BedrockAnthropicProvider] Generation successful');
            return result;
          } catch (error) {
            console.error('[BedrockAnthropicProvider] Generation error:', error);
            throw error;
          }
        }
      } as LanguageModel;
      
      console.log('[BedrockAnthropicProvider] Successfully initialized');
    } catch (error) {
      console.error('[BedrockAnthropicProvider] Initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Check if there is any tool usage in the entire conversation
   * This is crucial for AWS Bedrock Claude 3.5 as it requires toolConfig
   * for ALL requests in a conversation that has ANY tool usage
   */
  #hasAnyToolUsageInConversation(messages: any[]): boolean {
    if (!Array.isArray(messages) || messages.length === 0) {
      return false;
    }
    
    for (const message of messages) {
      // Check assistant messages for any kind of tool use
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        for (const content of message.content) {
          // Check all possible tool use formats
          if (content.toolUse || 
              content.type === 'tool-call' || 
              content.type === 'tool_call' || 
              content.type === 'toolUse' || 
              content.type === 'tool_use' || 
              content.type === 'tool-use') {
            return true;
          }
        }
      }
      
      // Check user or tool messages for tool results
      if ((message.role === 'user' || message.role === 'tool') && Array.isArray(message.content)) {
        for (const content of message.content) {
          // Check all possible tool result formats
          if (content.toolResult || 
              content.tool_result || 
              content.type === 'tool-result' || 
              content.type === 'tool_result' || 
              content.type === 'toolResult') {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Prepare tools for the AWS Bedrock Claude request format
   * This handles both tools provided directly in options and
   * extracting tool names from the conversation history
   */
  #prepareToolsForRequest(options: any): any[] {
    const tools: any[] = [];
    
    // Case 1: Tools provided directly in options.tools (preferred)
    if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
      for (const tool of options.tools) {
        tools.push({
          name: tool.name,
          description: tool.description || `Tool: ${tool.name}`,
          input_schema: tool.parameters || { type: 'object', properties: {} }
        });
      }
    }
    // Case 2: Tools provided in options.mode.tools (common format)
    else if (options.mode?.tools && Array.isArray(options.mode.tools) && options.mode.tools.length > 0) {
      for (const tool of options.mode.tools) {
        tools.push({
          name: tool.name,
          description: tool.description || `Tool: ${tool.name}`,
          input_schema: tool.parameters || { type: 'object', properties: {} }
        });
      }
    }
    // Case 3: Extract tools from conversation history
    else if (options.prompt && Array.isArray(options.prompt)) {
      const toolNamesUsed = new Set<string>();
      
      // Scan conversation for tool names
      for (const message of options.prompt) {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          for (const content of message.content) {
            // Get tool name from toolUse object
            if (content.toolUse && content.toolUse.name) {
              toolNamesUsed.add(content.toolUse.name);
            }
            // Get tool name from tool call object
            else if ((content.type === 'tool-call' || content.type === 'tool_call') && content.toolName) {
              toolNamesUsed.add(content.toolName);
            }
          }
        }
      }
      
      // Create tool definitions from the names
      for (const name of toolNamesUsed) {
        tools.push({
          name,
          description: `Tool: ${name}`,
          input_schema: { type: 'object', properties: {} }
        });
      }
    }
    
    return tools;
  }

  /**
   * Detects if there is any tool usage in the conversation messages
   */
  #detectToolUsageInMessages(messages: any[]): boolean {
    if (!messages || !Array.isArray(messages)) {
      return false;
    }
    
    // Look for toolUse in assistant messages
    const hasToolUse = messages.some(msg => {
      if (msg.role !== 'assistant' || !Array.isArray(msg.content)) {
        return false;
      }
      
      return msg.content.some((content: any) => {
        return content.type === 'tool_use' || 
               content.type === 'toolUse' || 
               content.type === 'tool-use' || 
               content.type === 'tool_call' || 
               content.type === 'tool-call';
      });
    });
    
    // Look for toolResult in user messages
    const hasToolResult = messages.some(msg => {
      if (msg.role !== 'user' || !Array.isArray(msg.content)) {
        return false;
      }
      
      return msg.content.some((content: any) => {
        return content.toolResult || content.tool_result;
      });
    });
    
    return hasToolUse || hasToolResult;
  }
  
  /**
   * Formats tools into the structure required by AWS Bedrock Claude
   */
  #formatToolsForBedrock(options: any): any[] {
    const formattedTools: any[] = [];
    
    // Case 1: Tools provided via options.mode.tools
    if (options.mode?.tools && Array.isArray(options.mode.tools)) {
      return options.mode.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        input_schema: tool.parameters || { type: 'object', properties: {} }
      }));
    }
    
    // Case 2: Extract tools from conversation history
    if (options.prompt && Array.isArray(options.prompt)) {
      for (const message of options.prompt) {
        if (message.role === 'assistant' && Array.isArray(message.content)) {
          for (const content of message.content) {
            // Various tool usage formats that might appear
            if (content.type === 'tool_use' || 
                content.type === 'toolUse' || 
                content.type === 'tool-use' || 
                content.type === 'tool_call' || 
                content.type === 'tool-call') {
              
              // Get the tool name from whatever field it might be in
              const toolName = content.toolName || content.name || content.tool || '';
              
              // Don't add duplicate tools
              if (toolName && !formattedTools.some(t => t.name === toolName)) {
                formattedTools.push({
                  name: toolName,
                  description: `Tool: ${toolName}`,
                  input_schema: { type: 'object', properties: {} }
                });
              }
            }
          }
        }
      }
    }
    
    return formattedTools;
  }

  model(): LanguageModel {
    return this.#model;
  }

  name(): string {
    return `${this.#providerName}::${this.#modelName}`;
  }
}

/**
 * Azure OpenAI provider implementation.
 * 
 * This provider integrates with Microsoft Azure's OpenAI service,
 * offering a secure, enterprise-grade deployment option for OpenAI models.
 * It requires Azure-specific credentials and endpoint information.
 */
export class AzureOpenAIProvider implements LLMProvider {
  #providerName = 'AzureOpenAI';
  #deploymentName: string;
  #client: OpenAI;
  #model: LanguageModel;

  constructor() {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
      throw new Error('Azure OpenAI credentials not found in environment variables');
    }

    this.#deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';
    
    // Initialize the Azure OpenAI client with the latest API format
    this.#client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${this.#deploymentName}`,
      defaultQuery: { 'api-version': '2024-10-21' }, // Using a newer API version
      defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
    });
    
    // Create a proper LanguageModel implementation
    const processMessages = (messagesInput: CoreMessage[] | any) => {
      // Check if messages is in the expected format or if it's in the prompt field
      let messages: CoreMessage[];
      
      if (Array.isArray(messagesInput)) {
        messages = messagesInput;
      } else if (messagesInput?.prompt && Array.isArray(messagesInput.prompt)) {
        messages = messagesInput.prompt;
      } else {
        console.error('[AzureOpenAIProvider] Cannot find valid messages in input:', messagesInput);
        throw new Error('Invalid messages format: cannot find messages array');
      }
      
      const formattedMessages = [];
      
      for (const msg of messages) {
        // Skip if msg doesn't have role and content
        if (!msg || !msg.role || !msg.content) {
          console.warn('[AzureOpenAIProvider] Skipping invalid message:', msg);
          continue;
        }
        
        let content: string;
        
        if (typeof msg.content === 'string') {
          // String content can be used directly
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // For array content, we need to extract text
          const textParts = msg.content.filter((part: any) => part.type === 'text');
          if (textParts.length > 0 && (textParts[0] as any).text) {
            content = (textParts[0] as any).text;
          } else {
            // If no text parts are found, stringify the entire content
            content = JSON.stringify(msg.content);
          }
        } else {
          // For other types, stringify
          content = JSON.stringify(msg.content);
        }
        
        // Handle message based on role
        switch (msg.role) {
          case 'system':
            formattedMessages.push({ role: 'system', content });
            break;
          case 'user':
            formattedMessages.push({ role: 'user', content });
            break;
          case 'assistant':
            formattedMessages.push({ role: 'assistant', content });
            break;
          case 'tool':
            // Skip tool messages as they're not directly supported in Azure OpenAI's API format
            // The information should be included in assistant messages
            console.warn('[AzureOpenAIProvider] Skipping tool message in Azure format');
            break;
          default:
            // Default to user for unknown roles
            formattedMessages.push({ role: 'user', content });
        }
      }
      
      return formattedMessages;
    };
    
    // Create a proper LanguageModel object with the expected structure
    this.#model = {
      // The doGenerate method that the ai library expects
      doGenerate: async (options: any) => {
        try {
          console.log('[AzureOpenAIProvider] doGenerate called with:', options);
          
          // Extract parameters from options
          const formattedMessages = processMessages(options);
          const maxTokens = options.maxTokens || 1000;
          const temperature = options.temperature ?? 0.7;
          
          console.log('[AzureOpenAIProvider] Sending request to Azure OpenAI with messages:', formattedMessages);
          
          // Call Azure OpenAI API
          const response = await this.#client.chat.completions.create({
            model: this.#deploymentName,
            messages: formattedMessages as any,
            max_tokens: maxTokens,
            temperature: temperature,
            // If tools are provided, format them for Azure OpenAI
            ...(options.mode?.tools ? {
              tools: options.mode.tools.map((tool: any) => ({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description || '',
                  parameters: tool.parameters || { type: 'object', properties: {} }
                }
              }))
            } : {}),
            // If tool choice is provided, format it for Azure OpenAI
            ...(options.mode?.toolChoice ? {
              tool_choice: options.mode.toolChoice.type === 'auto' ? 'auto' : 'required'
            } : {})
          });
          
          console.log('[AzureOpenAIProvider] Response received:', 
                      { status: 'success', content: response.choices[0]?.message?.content });
          
          // Properly format the message content for the ai library
          const messageContent = response.choices[0]?.message?.content || '';
          const toolCalls = response.choices[0]?.message?.tool_calls || [];
          
          // If we have tool calls, format them appropriately for the ai library
          const formattedContent = toolCalls.length > 0 
            ? [
                { type: 'text', text: messageContent || 'Processing with tools...' },
                ...toolCalls.map((toolCall: any) => ({
                  type: 'tool_call',
                  id: toolCall.id,
                  name: toolCall.function.name,
                  parameters: JSON.parse(toolCall.function.arguments || '{}')
                }))
              ]
            : messageContent;
          
          // Format the response to match the expected output for the ai library
          return {
            content: formattedContent,
            id: response.id,
            model: this.#deploymentName,
            usage: {
              promptTokens: response.usage?.prompt_tokens || 0,
              completionTokens: response.usage?.completion_tokens || 0,
              totalTokens: response.usage?.total_tokens || 0,
            },
          };
        } catch (error) {
          console.error('[AzureOpenAIProvider] Error in doGenerate:', error);
          throw error;
        }
      }
    } as unknown as LanguageModel;
  }

  model(): LanguageModel {
    return this.#model;
  }

  name(): string {
    return `${this.#providerName}::${this.#deploymentName}`;
  }
}

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
  #modelName = 'anthropic.claude-3-7-sonnet-20250219-v1:0';
  #model: LanguageModel;

  constructor() {
    const provider = createAmazonBedrock({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    
    // Create the model with Bedrock
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
          });
          
          console.log('[AzureOpenAIProvider] Response received:', 
                      { status: 'success', content: response.choices[0]?.message?.content });
          
          // Format the response to match the expected output
          const choice = response.choices[0];
          
          return {
            content: choice.message.content || '',
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

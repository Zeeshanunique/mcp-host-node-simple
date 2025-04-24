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
import { LanguageModel } from 'ai';
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

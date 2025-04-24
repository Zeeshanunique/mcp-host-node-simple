import {
  AnthropicProvider as AnthropicProviderType,
  createAnthropic,
} from '@ai-sdk/anthropic';
import {
  createOpenAI,
} from '@ai-sdk/openai';
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

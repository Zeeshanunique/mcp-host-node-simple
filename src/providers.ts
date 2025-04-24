// providers.ts - Manages available LLM providers
import { AnthropicProvider, OpenAIProvider, LLMProvider } from './llm-provider.js';

// Default provider setting
let currentProvider: 'anthropic' | 'openai' = 'anthropic';

// Function to get the appropriate provider instance based on the current setting
export function getProviderInstance(): LLMProvider {
  if (currentProvider === 'openai') {
    return new OpenAIProvider();
  }
  return new AnthropicProvider();
}

// Function to change the current provider
export function setProvider(provider: 'anthropic' | 'openai'): boolean {
  if (provider !== 'anthropic' && provider !== 'openai') {
    return false;
  }
  currentProvider = provider;
  return true;
}

// Function to get the current provider name
export function getCurrentProvider(): string {
  return currentProvider;
}

// Function to get all available providers
export function getAvailableProviders(): string[] {
  return ['anthropic', 'openai'];
} 
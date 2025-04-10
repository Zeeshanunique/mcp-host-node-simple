import { CoreMessage, generateText, Message, ToolResultPart, ToolResultUnion, AssistantContent } from 'ai';
import { LLMProvider } from './llm-provider.js';

export type LLMPrompt = Omit<
  Parameters<typeof generateText>[0],
  'model' | 'messages'
>;

export type LLMReponseMessages = Awaited<
  ReturnType<typeof generateText>
>['response']['messages'];

export type LLMToolResults = Array<ToolResultUnion<any>>;

export type LLMMessageType = 'user' | 'assistant' | 'system' | 'tool';

export type LLMMessages = Array<CoreMessage>;

export type LLMClientOption = {
  provider: LLMProvider;
  initialMessages?: CoreMessage[];
};

export class LLMClient {
  #provider: LLMProvider;
  #messages: LLMMessages = [];

  constructor({ provider, initialMessages = [] }: LLMClientOption) {
    this.#provider = provider;
    this.#messages = initialMessages;

    console.log('[LLMClient] Initialized with', provider.name());
    if (initialMessages.length > 0) {
        console.log('[LLMClient] Initialized with message history count:', initialMessages.length);
    }
  }

  provider() {
    return this.#provider;
  }

  messages() {
    return this.#messages;
  }

  append(role: LLMMessageType, content: string | AssistantContent | ToolResultPart | ReadonlyArray<ToolResultPart>) {
    if (role === 'tool') {
        const toolContent: ReadonlyArray<ToolResultPart> = Array.isArray(content)
            ? content as unknown as ReadonlyArray<ToolResultPart>
            : [content as ToolResultPart];
            
        this.#messages.push({ role, content: [...toolContent] });
    } else if (role === 'assistant') {
        this.#messages.push({ role, content: content as AssistantContent });
    } else if (role === 'user' && typeof content === 'string') {
        this.#messages.push({ role, content });
    } else if (role === 'system' && typeof content === 'string') {
        this.#messages.push({ role, content });
    } else {
        console.warn(`[LLMClient] Skipping append for role '${role}' due to unexpected content type:`, content);
    }
  }

  async #generateText(prompt: LLMPrompt = {}) {
    return await generateText({
      model: this.#provider.model(),
      messages: this.#messages,
      ...prompt,
    });
  }

  async generate(prompt?: LLMPrompt) {
    console.log(
      '[LLMClient] Lets generate a result',
      prompt?.tools ? `with tools ${Object.keys(prompt?.tools ?? {})}` : ''
    );

    return await this.#generateText(prompt);
  }
}

export const utils = {
  extractTextMessage(role: 'user' | 'assistant', messages: LLMReponseMessages) {
    const extractedMessages = [];

    for (const message of messages) {
      if (message.role !== role) {
        continue;
      }

      const type = typeof message.content;
      if (type === 'string') {
        extractedMessages.push(message.content);
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text') {
            extractedMessages.push(content.text);
          }
        }
      }
    }

    return extractedMessages;
  },
};

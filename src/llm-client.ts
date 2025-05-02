import { CoreMessage, generateText, Message, ToolResultPart, ToolResultUnion, AssistantContent } from 'ai';
import { LLMProvider } from './llm-provider.js';
import { SessionManager, Session } from './session-manager.js';

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
  sessionManager?: SessionManager;
};

export class LLMClient {
  #provider: LLMProvider;
  #messages: LLMMessages = [];
  #sessionManager?: SessionManager;
  #currentSessionId?: string;

  constructor({ provider, initialMessages = [], sessionManager }: LLMClientOption) {
    this.#provider = provider;
    this.#messages = initialMessages;
    this.#sessionManager = sessionManager;

    console.log('[LLMClient] Initialized with', provider.name());
    if (initialMessages.length > 0) {
        console.log('[LLMClient] Initialized with message history count:', initialMessages.length);
    }
    if (sessionManager) {
        console.log('[LLMClient] Using session-based memory management');
    }
  }

  provider() {
    return this.#provider;
  }

  messages() {
    // If we have a session manager and current session, return session messages
    if (this.#sessionManager && this.#currentSessionId) {
      return this.#sessionManager.getMessages(this.#currentSessionId);
    }
    // Otherwise return local messages
    return this.#messages;
  }

  /**
   * Set the current session ID for this client
   */
  setSessionId(sessionId: string): boolean {
    if (!this.#sessionManager) {
      console.warn('[LLMClient] Attempted to set session ID but no session manager is configured');
      return false;
    }
    
    const session = this.#sessionManager.getSession(sessionId);
    if (!session) {
      console.warn(`[LLMClient] Session ${sessionId} not found`);
      return false;
    }
    
    this.#currentSessionId = sessionId;
    console.log(`[LLMClient] Switched to session ${sessionId}`);
    return true;
  }
  
  /**
   * Create a new session and set it as current
   */
  createSession(userId: string, metadata: Record<string, any> = {}): Session | null {
    if (!this.#sessionManager) {
      console.warn('[LLMClient] Attempted to create session but no session manager is configured');
      return null;
    }
    
    const session = this.#sessionManager.createSession(userId, metadata);
    this.#currentSessionId = session.id;
    
    // If we have messages in memory, transfer them to the new session
    if (this.#messages.length > 0) {
      for (const message of this.#messages) {
        this.#sessionManager.addMessage(session.id, message);
      }
      this.#messages = []; // Clear local messages
    }
    
    console.log(`[LLMClient] Created and switched to session ${session.id} for user ${userId}`);
    return session;
  }

  append(role: LLMMessageType, content: string | AssistantContent | ToolResultPart | ReadonlyArray<ToolResultPart>) {
    let message: CoreMessage;
    
    if (role === 'tool') {
        const toolContent: ReadonlyArray<ToolResultPart> = Array.isArray(content)
            ? content as unknown as ReadonlyArray<ToolResultPart>
            : [content as ToolResultPart];
            
        message = { role, content: [...toolContent] };
    } else if (role === 'assistant') {
        message = { role, content: content as AssistantContent };
    } else if (role === 'user' && typeof content === 'string') {
        message = { role, content };
    } else if (role === 'system' && typeof content === 'string') {
        message = { role, content };
    } else {
        console.warn(`[LLMClient] Skipping append for role '${role}' due to unexpected content type:`, content);
        return;
    }
    
    // Add message to session if we have a session manager and current session
    if (this.#sessionManager && this.#currentSessionId) {
      this.#sessionManager.addMessage(this.#currentSessionId, message);
    } else {
      // Otherwise add to local messages
      this.#messages.push(message);
    }
  }

  async #generateText(prompt: LLMPrompt = {}) {
    // Use session messages if available, otherwise use local messages
    const messages = this.messages();
    
    return await generateText({
      model: this.#provider.model(),
      messages,
      ...prompt,
    });
  }

  async generate(prompt?: LLMPrompt) {
    console.log(
      '[LLMClient] Lets generate a result',
      prompt?.tools ? `with tools ${Object.keys(prompt?.tools ?? {})}` : ''
    );

    const result = await this.#generateText(prompt);
    
    // Create a new result object with formatted text
    return {
      ...result,
      text: result.text ? this.formatResponse(result.text) : result.text
    };
  }
  
  /**
   * Format the response to handle Markdown syntax
   * This ensures proper rendering of formatted text
   */
  formatResponse(text: string): string {
    // Option 1: Convert Markdown to plain text by removing formatting characters
    return text
      // Remove heading markers
      .replace(/^###\s+/gm, '')
      .replace(/^##\s+/gm, '')
      .replace(/^#\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      // Remove bullet points
      .replace(/^\s*-\s+/gm, '• ')
      // Remove backticks
      .replace(/`([^`]+)`/g, '$1')
      // Fix spacing
      .replace(/\n{3,}/g, '\n\n');
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

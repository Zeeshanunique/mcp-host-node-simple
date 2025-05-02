import { CoreMessage } from 'ai';
import logger from './utils/logger.js';

export type SessionOptions = {
  maxSessionAge?: number; // milliseconds
  maxSessionsPerUser?: number;
  maxMessagesPerSession?: number;
};

export type Session = {
  id: string;
  userId: string;
  messages: CoreMessage[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, any>;
};

export class SessionManager {
  #sessions: Map<string, Session>;
  #userSessions: Map<string, Set<string>>;
  #options: SessionOptions;

  constructor(options: SessionOptions = {}) {
    this.#sessions = new Map();
    this.#userSessions = new Map();
    this.#options = {
      maxSessionAge: options.maxSessionAge || 24 * 60 * 60 * 1000, // 24 hours
      maxSessionsPerUser: options.maxSessionsPerUser || 5,
      maxMessagesPerSession: options.maxMessagesPerSession || 100
    };
    
    logger.info(`[SessionManager] Initialized with options: ${JSON.stringify(this.#options)}`);
    
    // Set up periodic cleanup
    setInterval(() => this.cleanupExpiredSessions(), this.#options.maxSessionAge! / 2);
  }

  /**
   * Create a new session for a user
   */
  createSession(userId: string, metadata: Record<string, any> = {}): Session {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session: Session = {
      id: sessionId,
      userId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata
    };
    
    this.#sessions.set(sessionId, session);
    
    // Track this session for the user
    if (!this.#userSessions.has(userId)) {
      this.#userSessions.set(userId, new Set());
    }
    this.#userSessions.get(userId)!.add(sessionId);
    
    // Check if user has too many sessions and prune oldest if needed
    this.pruneUserSessions(userId);
    
    logger.debug({ userId, sessionId }, '[SessionManager] Created new session');
    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | undefined {
    const session = this.#sessions.get(sessionId);
    
    if (session) {
      // Update the session's last access time
      session.updatedAt = Date.now();
      this.#sessions.set(sessionId, session);
    }
    
    return session;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): Session[] {
    const sessionIds = this.#userSessions.get(userId) || new Set();
    const sessions: Session[] = [];
    
    for (const sessionId of sessionIds) {
      const session = this.#sessions.get(sessionId);
      if (session) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: CoreMessage): boolean {
    const session = this.#sessions.get(sessionId);
    
    if (!session) {
      logger.warn({ sessionId }, '[SessionManager] Attempted to add message to non-existent session');
      return false;
    }
    
    session.messages.push(message);
    session.updatedAt = Date.now();
    
    // Enforce message limit per session
    if (session.messages.length > this.#options.maxMessagesPerSession!) {
      session.messages = session.messages.slice(-this.#options.maxMessagesPerSession!);
      logger.debug({ sessionId, messageCount: session.messages.length }, 
                   '[SessionManager] Trimmed session messages to limit');
    }
    
    return true;
  }

  /**
   * Get all messages for a session
   */
  getMessages(sessionId: string): CoreMessage[] {
    const session = this.#sessions.get(sessionId);
    
    if (!session) {
      logger.warn({ sessionId }, '[SessionManager] Attempted to get messages from non-existent session');
      return [];
    }
    
    // Update access time
    session.updatedAt = Date.now();
    
    return [...session.messages];
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const session = this.#sessions.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    this.#sessions.delete(sessionId);
    
    // Remove from user's session list
    const userSessions = this.#userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
    }
    
    logger.debug({ sessionId, userId: session.userId }, '[SessionManager] Deleted session');
    
    return true;
  }

  /**
   * Update session metadata
   */
  updateSessionMetadata(sessionId: string, metadata: Record<string, any>): boolean {
    const session = this.#sessions.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    session.metadata = { ...session.metadata, ...metadata };
    session.updatedAt = Date.now();
    
    return true;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.#sessions.entries()) {
      if (now - session.updatedAt > this.#options.maxSessionAge!) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.deleteSession(sessionId);
    }
    
    if (expiredSessions.length > 0) {
      logger.info({ count: expiredSessions.length }, '[SessionManager] Cleaned up expired sessions');
    }
  }

  /**
   * Ensure a user doesn't have too many sessions
   */
  private pruneUserSessions(userId: string): void {
    const userSessionIds = this.#userSessions.get(userId);
    
    if (!userSessionIds || userSessionIds.size <= this.#options.maxSessionsPerUser!) {
      return;
    }
    
    // Get all sessions for the user
    const sessions = Array.from(userSessionIds)
      .map(id => this.#sessions.get(id)!)
      .filter(Boolean)
      .sort((a, b) => a.updatedAt - b.updatedAt); // Sort by oldest first
    
    // Remove oldest sessions until we're under the limit
    const sessionsToRemove = sessions.slice(0, sessions.length - this.#options.maxSessionsPerUser!);
    
    for (const session of sessionsToRemove) {
      this.deleteSession(session.id);
    }
    
    logger.info({ userId, removed: sessionsToRemove.length }, 
                '[SessionManager] Pruned oldest sessions for user');
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Get session stats
   */
  getStats(): { totalSessions: number, totalUsers: number } {
    return {
      totalSessions: this.#sessions.size,
      totalUsers: this.#userSessions.size
    };
  }
} 
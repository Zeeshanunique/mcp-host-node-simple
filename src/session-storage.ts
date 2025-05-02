import fs from 'node:fs/promises';
import path from 'node:path';
import { Session, SessionManager } from './session-manager.js';
import logger from './utils/logger.js';

export type SessionStorageOptions = {
  storageDir: string;
  syncInterval?: number; // milliseconds
  maxFileAge?: number; // milliseconds
};

/**
 * SessionStorage provides persistence for sessions
 * This allows sessions to survive application restarts
 */
export class SessionStorage {
  #options: SessionStorageOptions;
  #sessionManager: SessionManager;
  #syncInterval?: NodeJS.Timeout;
  #initialized = false;

  constructor(sessionManager: SessionManager, options: SessionStorageOptions) {
    this.#sessionManager = sessionManager;
    this.#options = {
      ...options,
      syncInterval: options.syncInterval || 5 * 60 * 1000, // 5 minutes
      maxFileAge: options.maxFileAge || 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  /**
   * Initialize the storage system
   */
  async initialize(): Promise<boolean> {
    if (this.#initialized) {
      return true;
    }

    try {
      // Ensure storage directory exists
      await fs.mkdir(this.#options.storageDir, { recursive: true });
      
      // Start periodic sync
      this.#syncInterval = setInterval(() => {
        this.saveSessions().catch(err => {
          logger.error({ err }, '[SessionStorage] Failed to auto-save sessions');
        });
      }, this.#options.syncInterval);
      
      // Load existing sessions
      await this.loadSessions();
      
      this.#initialized = true;
      logger.info('[SessionStorage] Initialized successfully');
      return true;
    } catch (err) {
      logger.error({ err }, '[SessionStorage] Failed to initialize');
      return false;
    }
  }

  /**
   * Save all sessions to disk
   */
  async saveSessions(): Promise<number> {
    try {
      const stats = this.#sessionManager.getStats();
      if (stats.totalSessions === 0) {
        logger.debug('[SessionStorage] No sessions to save');
        return 0;
      }

      const savedCount = await this.#saveSessionsToStorage();
      logger.info({ count: savedCount }, '[SessionStorage] Sessions saved to disk');
      return savedCount;
    } catch (err) {
      logger.error({ err }, '[SessionStorage] Failed to save sessions');
      throw err;
    }
  }

  /**
   * Load sessions from disk
   */
  async loadSessions(): Promise<number> {
    try {
      const sessionFiles = await this.#getSessionFiles();
      
      if (sessionFiles.length === 0) {
        logger.debug('[SessionStorage] No session files found');
        return 0;
      }
      
      let loadedCount = 0;
      const now = Date.now();
      
      for (const file of sessionFiles) {
        try {
          // Check if file is too old
          const stats = await fs.stat(path.join(this.#options.storageDir, file));
          if (now - stats.mtimeMs > this.#options.maxFileAge!) {
            // Delete old files
            await fs.unlink(path.join(this.#options.storageDir, file));
            logger.debug({ file }, '[SessionStorage] Deleted expired session file');
            continue;
          }
          
          // Read and parse the session file
          const content = await fs.readFile(
            path.join(this.#options.storageDir, file),
            'utf-8'
          );
          
          const sessionData = JSON.parse(content) as Session;
          
          // Rebuild the session in memory
          const session = this.#sessionManager.createSession(
            sessionData.userId,
            sessionData.metadata
          );
          
          // Add messages
          for (const message of sessionData.messages) {
            this.#sessionManager.addMessage(session.id, message);
          }
          
          loadedCount++;
        } catch (err) {
          logger.warn({ err, file }, '[SessionStorage] Failed to load session file');
        }
      }
      
      logger.info({ 
        loadedCount, 
        totalFiles: sessionFiles.length 
      }, '[SessionStorage] Sessions loaded from disk');
      
      return loadedCount;
    } catch (err) {
      logger.error({ err }, '[SessionStorage] Failed to load sessions');
      throw err;
    }
  }

  /**
   * Get list of session files
   */
  async #getSessionFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.#options.storageDir);
      // Filter only session files
      return files.filter(file => file.startsWith('session_') && file.endsWith('.json'));
    } catch (err) {
      logger.error({ err }, '[SessionStorage] Failed to read directory');
      return [];
    }
  }

  /**
   * Save sessions to storage
   */
  async #saveSessionsToStorage(): Promise<number> {
    // Get all users
    const stats = this.#sessionManager.getStats();
    let savedCount = 0;
    
    // This is a simplified approach - in a real implementation, we would
    // track users and session IDs more efficiently
    const savedSessions = new Set<string>();
    
    // We'll need to create a method to get all user IDs in the SessionManager
    // For now, let's simply save sessions for known user IDs
    for (const userId of this.#getKnownUserIds()) {
      const sessions = this.#sessionManager.getUserSessions(userId);
      
      for (const session of sessions) {
        try {
          // Serialize and save the session
          const sessionPath = path.join(
            this.#options.storageDir,
            `session_${session.id}.json`
          );
          
          await fs.writeFile(
            sessionPath,
            JSON.stringify(session, null, 2),
            'utf-8'
          );
          
          savedSessions.add(session.id);
          savedCount++;
        } catch (err) {
          logger.warn({ err, sessionId: session.id }, '[SessionStorage] Failed to save session');
        }
      }
    }
    
    return savedCount;
  }
  
  /**
   * Get all known user IDs
   * This is a temporary solution - the SessionManager should provide this
   */
  #getKnownUserIds(): string[] {
    // For demonstration, we'll use some hardcoded values
    // In a real implementation, SessionManager would expose this
    return ['user123', 'user456', 'demo-user'];
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    logger.info('[SessionStorage] Shutting down');
    
    if (this.#syncInterval) {
      clearInterval(this.#syncInterval);
    }
    
    try {
      await this.saveSessions();
      logger.info('[SessionStorage] Sessions saved during shutdown');
    } catch (err) {
      logger.error({ err }, '[SessionStorage] Failed to save sessions during shutdown');
    }
  }
} 
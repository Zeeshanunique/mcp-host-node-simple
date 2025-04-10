import React, { useState, useEffect } from 'react';
import './App.css';

interface ToolResult {
  name: string;
  result: string;
}

interface ChatResponse {
  initialResponse: string;
  toolResults: ToolResult[];
  finalResponse: string | null;
}

interface ToolsResponse {
  tools: string[];
}

function App() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available tools when component mounts
  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/tools');
        const data = await res.json() as ToolsResponse;
        setTools(data.tools || []);
      } catch (err) {
        console.error('Failed to fetch tools:', err);
        setError('Failed to connect to the server. Please try again later.');
      }
    };

    fetchTools();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json() as ChatResponse;
      setResponse(data);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>MCP Host Chat Interface</h1>
        <div className="tools-container">
          <h3>Available Tools:</h3>
          {tools.length > 0 ? (
            <ul>
              {tools.map((tool, index) => (
                <li key={index}>{tool}</li>
              ))}
            </ul>
          ) : (
            <p>Loading tools...</p>
          )}
        </div>
      </header>

      <div className="chat-container">
        {response && (
          <div className="response-container">
            <div className="assistant-response">
              <h3>Assistant:</h3>
              <p>{response.initialResponse}</p>
            </div>
            
            {response.toolResults.length > 0 && (
              <div className="tool-results">
                <h3>Tool Results:</h3>
                {response.toolResults.map((tool, index) => (
                  <div key={index} className="tool-result">
                    <h4>{tool.name}</h4>
                    <p>{tool.result}</p>
                  </div>
                ))}
              </div>
            )}
            
            {response.finalResponse && (
              <div className="final-response">
                <h3>Assistant's Final Answer:</h3>
                <p>{response.finalResponse}</p>
              </div>
            )}
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="message-form">
          <textarea
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            placeholder="Enter your message here (e.g., 'Use add tool to calculate 100 + 200')"
            rows={4}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !message.trim()}>
            {isLoading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
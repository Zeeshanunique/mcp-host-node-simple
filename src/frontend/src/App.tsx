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

// Simplified tool metadata interface
interface ToolInfo {
  name: string;
  description: string;
  parameters: string;
  example: string;
}

function App() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Generate tool info dynamically based on tool name
  const getToolInfo = (toolName: string): ToolInfo => {
    // Default formatting for display name (convert snake_case or camelCase to Title Case)
    const formatDisplayName = (name: string) => {
      return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^\w/, c => c.toUpperCase())
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    };

    // Convert the tool name to a readable format
    const displayName = formatDisplayName(toolName);
    
    // Generate description and example based on the tool name
    let description = `Performs ${toolName.replace(/_/g, ' ')} operations`;
    let parameters = "Varies based on input";
    let example = `Use ${toolName} tool...`;

    // Common patterns for default examples and parameters
    if (toolName === 'add') {
      description = "Adds two numbers together";
      parameters = "a: number, b: number";
      example = "Use add tool to calculate 100 + 200";
    } else if (toolName === 'minus') {
      description = "Subtracts one number from another";
      parameters = "a: number, b: number";
      example = "Use minus tool to calculate 500 - 125";
    } else if (toolName === 'search') {
      description = "Search the web for information";
      parameters = "query: string";
      example = "Search for information about climate change";
    } else if (toolName === 'deep_research') {
      description = "Conducts in-depth research on a topic";
      parameters = "topic: string";
      example = "Research the history of quantum computing";
    } else if (toolName === 'get_weather') {
      description = "Gets weather information for a location";
      parameters = "location: string, units: 'metric'|'imperial' (optional)";
      example = "What's the weather like in Tokyo?";
    } else if (toolName === 'summarize_text') {
      description = "Creates a summary of provided text";
      parameters = "text: string";
      example = "Summarize this article about renewable energy...";
    } else if (toolName === 'get_destination_info') {
      description = "Gets travel information about destinations";
      parameters = "destination: string, interests: string[] (optional)";
      example = "Tell me about visiting Paris with interests in art and food";
    }

    return {
      name: displayName,
      description,
      parameters,
      example
    };
  };

  // Fetch available tools when component mounts
  useEffect(() => {
    const fetchTools = async () => {
      try {
        // Using relative URL instead of hardcoded localhost
        const res = await fetch('/api/tools');
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
      // Using relative URL instead of hardcoded localhost
      const response = await fetch('/api/chat', {
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

  const handleToolSelect = (tool: string) => {
    setSelectedTool(tool);
    
    // Generate a template message based on the selected tool
    const toolInfo = getToolInfo(tool);
    setMessage(toolInfo.example);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const renderToolsTab = () => (
    <div className="tools-tab">
      <h2>Available Tools</h2>
      <div className="tools-grid">
        {tools.map((tool) => {
          const toolInfo = getToolInfo(tool);
          return (
            <div 
              key={tool} 
              className={`tool-card ${selectedTool === tool ? 'selected' : ''}`}
              onClick={() => handleToolSelect(tool)}
            >
              <h3>{toolInfo.name}</h3>
              <p className="tool-description">{toolInfo.description}</p>
              <div className="tool-parameters">
                <strong>Parameters:</strong> {toolInfo.parameters}
              </div>
              <div className="tool-example">
                <em>Example:</em> "{toolInfo.example}"
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderChatTab = () => (
    <div className="chat-tab">
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
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>MCP Host Chat Interface</h1>
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => handleTabChange('chat')}
          >
            Chat
          </button>
          <button 
            className={`tab-button ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => handleTabChange('tools')}
          >
            Tools ({tools.length})
          </button>
        </div>
      </header>

      <div className="tab-content">
        {activeTab === 'chat' ? renderChatTab() : renderToolsTab()}
      </div>
    </div>
  );
}

export default App;
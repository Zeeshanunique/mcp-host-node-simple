import React, { useState, useEffect, useRef } from 'react';
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const [message, setMessage] = useState('');
  const [chatResponse, setResponse] = useState<ChatResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const chatEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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
    if (!message.trim() || isLoading) return;

    const newUserMessage: ChatMessage = { role: 'user', content: message };
    const updatedHistory = [...chatHistory, newUserMessage];

    setChatHistory(updatedHistory);
    setMessage('');
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history: updatedHistory }),
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to get response from server');
      }

      const data = await apiResponse.json() as ChatResponse;
      setResponse(data);

      let assistantMessages: ChatMessage[] = [];
      if (data.initialResponse) {
        assistantMessages.push({ role: 'assistant', content: data.initialResponse });
      }
      if (data.finalResponse && (data.toolResults.length > 0 || !data.initialResponse)) {
        if (data.finalResponse !== data.initialResponse) {
          assistantMessages.push({ role: 'assistant', content: data.finalResponse });
        }
      }

      setChatHistory(prevHistory => [...prevHistory, ...assistantMessages]);

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to get response. Please try again.');
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
      <div className="chat-history">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`message ${msg.role}-message`}>
            <span className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}:</span>
            <p className="message-content">{msg.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant-message loading-indicator">
            <span>Thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
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

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="message-form">
        <textarea
          value={message}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
          placeholder="Enter your message here (e.g., 'Use add tool to calculate 100 + 200')"
          rows={4}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !message.trim()}>
          {isLoading ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}

export default App;
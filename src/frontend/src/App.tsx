import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Textarea } from './components/ui/textarea';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/ui/collapsible';
import { KeyboardShortcuts } from './components/keyboard-shortcuts';
import { ShortcutsHelpDialog } from './components/shortcuts-help-dialog';
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';
import { ThemeToggle } from './components/ui/theme-toggle';
import { MessageSquare, Lightbulb, Send, Loader2, Bot, Code, ChevronsDown, Info, Cpu, AlertTriangle, Trash2, CheckCircle, RefreshCw, ChevronDown, X, ServerIcon as Server, Wrench } from 'lucide-react';
import { MarkdownRenderer } from './components/markdown-renderer';

interface ToolResult {
  name: string;
  result: string;
  sequence?: number;    // Position in the sequence
  totalSteps?: number;  // Total number of steps
}

interface ChatResponse {
  initialResponse: string;
  toolResults: ToolResult[];
  finalResponse: string | null;
  metadata?: {
    selectedServer: string | null;
    selectedTool: string | null; 
    useAllServerTools: boolean;
    availableTools: string[];
    toolCount: number;
  };
}

interface ToolsResponse {
  tools: string[];
}

// Add server data interface
interface ServerResponse {
  servers: Record<string, string[]>;
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
  id?: string;  // Adding optional id property to fix linter error
}

// Add a new interface for provider selection
interface ProviderInfo {
  provider: string;
  availableProviders: string[];
}

function App() {
  const [message, setMessage] = useState('');
  const [chatResponse, setResponse] = useState<ChatResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [useAllServerTools, setUseAllServerTools] = useState<boolean>(false);
  const chatEndRef = useRef<null | HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Add provider state with more detailed provider information
  const [currentProvider, setCurrentProvider] = useState<string>('anthropic');
  const [availableProviders, setAvailableProviders] = useState<string[]>(['anthropic', 'openai', 'bedrock', 'azure']);
  
  // Add provider display names for better UI presentation
  const providerDisplayNames: Record<string, string> = {
    'anthropic': 'Anthropic Claude',
    'openai': 'OpenAI',
    'bedrock': 'AWS Bedrock Claude 3.5',
    'azure': 'Azure OpenAI'
  };

  // Add servers state - maps server names to their tools
  const [servers, setServers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Add a small delay to ensure all content is rendered before scrolling
    const scrollTimeout = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
    
    return () => clearTimeout(scrollTimeout);
  }, [chatHistory, chatResponse]);

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
    }

    return {
      name: displayName,
      description,
      parameters,
      example,
    };
  };

  // Fetch available tools
  const fetchTools = async () => {
    try {
      // Get the API URL from environment variables
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6754';
      const response = await fetch(`${apiUrl}/api/tools`);
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }
      const data: ToolsResponse = await response.json();
      
      // Use only the tools returned by the MCP host
      setTools(data.tools || []);
      
      console.log("Loaded tools from MCP host:", data.tools);
      
      // Reset selected tool if it's no longer available
      if (selectedTool && !data.tools.includes(selectedTool)) {
        setSelectedTool(null);
        toast({
          title: "Tool unavailable",
          description: "The previously selected tool is no longer available."
        });
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
      setError('Failed to fetch available tools. Please try again later.');
    }
  };

  // Fetch the current provider information
  const fetchProvider = async () => {
    try {
      // Get the API URL from environment variables
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6754';
      const response = await fetch(`${apiUrl}/api/provider`);
      if (!response.ok) {
        throw new Error('Failed to fetch provider information');
      }
      const data: ProviderInfo = await response.json();
      
      setCurrentProvider(data.provider);
      setAvailableProviders(data.availableProviders);
      
      console.log("Current LLM provider:", data.provider);
    } catch (error) {
      console.error('Error fetching provider information:', error);
      // Don't show an error toast for this, as it's not critical
    }
  };

  // Fetch servers and their associated tools
  const fetchServers = async () => {
    try {
      // Get the API URL from environment variables
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6754';
      
      // Clear existing servers to show refreshing state
      setServers({});
      
      // Fetch servers from the dedicated endpoint
      const serversResponse = await fetch(`${apiUrl}/api/servers`);
      if (serversResponse.ok) {
        const serversData: ServerResponse = await serversResponse.json();
        
        // Sort the tools within each server alphabetically for better display
        const sortedServers: Record<string, string[]> = {};
        Object.entries(serversData.servers).forEach(([serverName, tools]) => {
          sortedServers[serverName] = [...tools].sort();
        });
        
        setServers(sortedServers);
        
        // Log detailed server information
        console.log("Fetched servers from API:", sortedServers);
        console.log(`Found ${Object.keys(sortedServers).length} servers with ${Object.values(sortedServers).flat().length} total tools`);
        
        // Show success toast
        toast({
          title: "Servers Refreshed",
          description: `Successfully loaded ${Object.keys(sortedServers).length} servers with ${Object.values(sortedServers).flat().length} tools`
        });
        
        return;
      }
      
      // If the servers endpoint failed, fall back to the tools endpoint
      toast({
        variant: "default",
        title: "Server Mapping Unavailable",
        description: "Using fallback method to group tools by pattern matching"
      });
      
      // Fallback method - fetch all tools
      const response = await fetch(`${apiUrl}/api/tools`);
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }
      
      const data = await response.json();
      const allTools = data.tools || [];
      
      // Show error toast if no tools were found
      if (allTools.length === 0) {
        toast({
          variant: "destructive",
          title: "No Tools Available",
          description: "No tools were found on the server."
        });
        return;
      }
      
      // Group all tools into a single "all tools" category since we can't determine server mapping
      const fallbackServers: Record<string, string[]> = {
        "all_tools": allTools.sort()
      };
      
      setServers(fallbackServers);
      console.log("Using fallback server grouping:", fallbackServers);
      
      // Show toast notification
      toast({
        title: "Fallback Grouping Applied",
        description: `Showing all ${allTools.length} tools in a single group`
      });
      
    } catch (error) {
      console.error('Error fetching servers and tools:', error);
      // Show error toast
      toast({
        variant: "destructive",
        title: "Server Refresh Failed",
        description: "Unable to load servers. Check console for details."
      });
    }
  };

  // Handle provider change
  const handleProviderChange = async (provider: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6754';
      const response = await fetch(`${apiUrl}/api/provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to change provider');
      }
      
      const data = await response.json();
      setCurrentProvider(data.provider);
      
      toast({
        title: "Provider Changed",
        description: `Now using ${data.provider} as the LLM provider`,
      });
    } catch (error) {
      console.error('Error changing provider:', error);
      toast({
        variant: "destructive",
        title: "Provider Change Failed",
        description: "Failed to change the LLM provider. Please try again.",
      });
    }
  };

  useEffect(() => {
    fetchTools();
    fetchProvider();
    fetchServers();
  }, []);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };

    setChatHistory((prev) => [...prev, newUserMessage]);
    setMessage("");
    setIsLoading(true);
    
    // Reset the chat response state when a new message is sent
    setResponse(null);

    try {
      // Get the API URL from environment variables
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6754';
      
      // Create a copy of the chat history that includes the new message
      const fullHistory = [...chatHistory, newUserMessage];
      
      // Format the history for the API
      const formattedHistory = fullHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history: formattedHistory, // Send the complete chat history
          selectedTool: selectedTool,
          selectedServer: selectedServer,
          useAllServerTools: useAllServerTools,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data: ChatResponse = await response.json();
      setResponse(data);

      // Add assistant's response to chat history
      if (data.initialResponse) {
        // Type assertion to ensure initialResponse is treated as string
        const safeInitialResponse: string = data.initialResponse;
        setChatHistory(prev => [...prev, { role: 'assistant', content: safeInitialResponse }]);
      }
      
      // Only add the final response to chat history if it exists and is not null
      if (data.finalResponse) {
        // Type assertion to ensure finalResponse is treated as string and not null
        const safeResponse: string = data.finalResponse;
        setChatHistory(prev => [...prev, { role: 'assistant', content: safeResponse }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tool selection
  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    setUseAllServerTools(false);
    
    // Get example prompt from the tool info
    const toolInfo = getToolInfo(toolId);
    if (toolInfo && toolInfo.example) {
      setMessage(toolInfo.example);
    }
    
    // Automatically switch to chat tab
    setActiveTab('chat');
  };
  
  // Handle server selection to use all its tools
  const handleServerSelect = (serverId: string) => {
    setSelectedServer(serverId);
    setSelectedTool(null);
    setUseAllServerTools(true);
    
    // Optional: Set a default prompt for the selected server
    setMessage(`Use all tools from server "${serverId}" to help me with the following:`);
    
    // Automatically switch to chat tab
    setActiveTab('chat');
  };

  // Clear chat history
  const handleClearChat = () => {
    if (chatHistory.length === 0) return;

    // Show confirmation dialog using window.confirm to avoid ESLint warning
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setChatHistory([]);
      setResponse(null);
      toast({
        title: "Chat Cleared",
        description: "Your conversation has been reset."
      });
    }
  };

  // Handle send message with keyboard shortcut
  const handleKeySend = () => {
    if (message.trim() && !isLoading) {
      handleSubmit(new Event('submit') as any);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 w-full bg-background border-b py-2">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-primary">MCP Host Interface</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <select
                value={currentProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="text-sm rounded-md border border-input bg-background px-3 py-1"
              >
                {availableProviders.map(provider => (
                  <option 
                    key={provider} 
                    value={provider}
                  >
                    {providerDisplayNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)}
                    {provider === 'bedrock' ? ' (MCP Ready)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {selectedServer && useAllServerTools && (
              <Badge variant="outline" className="flex items-center gap-1 text-sm">
                <Server className="h-3 w-3" />
                Using {selectedServer} server
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-4 w-4 p-0 ml-1" 
                  onClick={() => {setSelectedServer(null); setUseAllServerTools(false);}}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {selectedTool && (
              <Badge variant="outline" className="flex items-center gap-1 text-sm">
                <Wrench className="h-3 w-3" />
                Using {selectedTool}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-4 w-4 p-0 ml-1" 
                  onClick={() => setSelectedTool(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            <span className="text-sm text-muted-foreground hidden md:inline-flex items-center gap-1">
              <Code className="h-4 w-4" />
              {tools.length} Tools Available
            </span>
            <ShortcutsHelpDialog />
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      {/* Keyboard shortcuts handler */}
      <KeyboardShortcuts 
        onSend={handleKeySend}
        onClearChat={handleClearChat}
        onSwitchToTools={() => setActiveTab('tools')}
        onSwitchToChat={() => setActiveTab('chat')}
        onSwitchToServers={() => setActiveTab('servers')}
        isInputEmpty={!message.trim()}
      />

      <main className="flex-1 container mx-auto p-2 flex flex-col">
        <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="self-center mb-4 w-full sm:w-auto">
            <TabsTrigger value="chat" className="flex items-center gap-2 flex-1 sm:flex-initial">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2 flex-1 sm:flex-initial">
              <Lightbulb className="h-4 w-4" />
              Tools
              {tools.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {tools.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="servers" className="flex items-center gap-2 flex-1 sm:flex-initial">
              <Cpu className="h-4 w-4" />
              Servers
              {Object.keys(servers).length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.keys(servers).length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chat" className="flex-1 flex flex-col space-y-4">
            <Card className="flex-1 flex flex-col border-0 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Chat History
                  </CardTitle>
                  <CardDescription>Interact with the AI assistant using the available tools.</CardDescription>
                </div>
                {selectedServer && useAllServerTools && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground mb-1">Using tools from server: <strong>{selectedServer}</strong></span>
                    {chatResponse?.metadata?.availableTools && (
                      <Badge variant="outline" className="px-2 py-1">
                        {chatResponse.metadata.toolCount} tools available
                      </Badge>
                    )}
                  </div>
                )}
                {chatHistory.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center gap-1"
                    onClick={handleClearChat}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Clear Chat</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <ScrollArea className="h-[calc(75vh-8rem)] pr-4">
                  <div className="space-y-4">
                    {chatHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4">
                        <Bot className="h-12 w-12 mb-4 text-primary" />
                        <h3 className="text-xl font-semibold mb-2 text-foreground">Welcome to MCP Host Interface</h3>
                        <p className="text-center mb-4">This interface allows you to interact with AI tools using Model Context Protocol (MCP).</p>
                        <Alert variant="info" className="mb-2 max-w-md">
                          <Info className="h-4 w-4" />
                          <AlertTitle>Available Tools</AlertTitle>
                          <AlertDescription>
                            {tools.length > 0 ? (
                              <>There are {tools.length} available tools. Switch to the Tools tab to see them all.</>
                            ) : (
                              <>Waiting for tools to connect. Check back soon.</>
                            )}
                          </AlertDescription>
                        </Alert>
                        <p className="mt-4 text-sm">Type a message below to get started!</p>
                      </div>
                    ) : (
                      // Display all messages
                      chatHistory.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div 
                            className={`rounded-lg p-4 max-w-[80%] ${msg.role === 'user' 
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                            }`}
                          >
                            {msg.role === 'user' ? (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            ) : (
                              <MarkdownRenderer 
                                content={msg.content} 
                                className="whitespace-pre-wrap break-words" 
                              />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    
                    {/* Show tool results after all chat messages */}
                    {chatResponse && chatResponse.toolResults && chatResponse.toolResults.length > 0 && (
                      <>
                        <div className="flex items-center justify-center w-full px-4 py-2">
                          <div className="w-full flex items-center">
                            <div className="h-1 bg-primary/30 rounded-full flex-grow" />
                            <div className="mx-2 text-xs text-muted-foreground flex items-center">
                              <Info className="h-3 w-3 mr-1" />
                              Tool Execution Flow ({chatResponse.toolResults.length} step{chatResponse.toolResults.length > 1 ? 's' : ''})
                            </div>
                            <div className="h-1 bg-primary/30 rounded-full flex-grow" />
                          </div>
                        </div>

                        <div className="flex justify-start my-2">
                          <Collapsible className="w-full max-w-[80%] bg-muted/30 rounded-lg border" defaultOpen={false}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="flex w-full justify-between p-2 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Cpu className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium">
                                    Tool Results ({chatResponse.toolResults.length})
                                  </span>
                                </div>
                                <ChevronsDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-4 pb-4">
                              <div className="space-y-4">
                                {chatResponse.toolResults.map((tool, idx) => (
                                  <div key={idx} className={`rounded-md p-3 border-l-2 ${
                                    tool.name.includes('weather') ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-400' :
                                    tool.name.includes('search') ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-400' :
                                    tool.name.includes('destination') ? 'bg-green-50/50 dark:bg-green-950/20 border-green-400' :
                                    'bg-muted border-primary/50'
                                  }`}>
                                    <div className="flex items-center justify-between font-medium text-sm mb-2 text-muted-foreground">
                                      <div className="flex items-center gap-2">
                                        <Code className="h-4 w-4" />
                                        <span className="font-semibold">{tool.name}</span>
                                      </div>
                                      {/* Show sequence information if available */}
                                      {tool.sequence && tool.totalSteps && (
                                        <Badge variant="outline" className={`ml-auto ${
                                          tool.name.includes('weather') ? 'bg-blue-100 dark:bg-blue-900' :
                                          tool.name.includes('search') ? 'bg-violet-100 dark:bg-violet-900' :
                                          tool.name.includes('destination') ? 'bg-green-100 dark:bg-green-900' :
                                          ''
                                        }`}>
                                          Step {tool.sequence} of {tool.totalSteps}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="whitespace-pre-wrap font-mono text-xs bg-background/80 p-3 rounded-sm overflow-x-auto">
                                      <MarkdownRenderer content={tool.result} className="text-xs" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </>
                    )}

                    {/* Final complete answer */}
                    {chatResponse && chatResponse.finalResponse && (
                      <div className="flex justify-start w-full">
                        <Collapsible className="w-full max-w-[80%] bg-primary/15 rounded-lg border-l-4 border-primary" defaultOpen={true}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="flex w-full justify-between p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-primary" />
                                <span className="font-semibold text-base">Complete Answer</span>
                              </div>
                              {chatResponse.toolResults && chatResponse.toolResults.length > 0 && (
                                <Badge variant="outline" className="text-xs">Based on {chatResponse.toolResults.length} tool result{chatResponse.toolResults.length > 1 ? 's' : ''}</Badge>
                              )}
                              <ChevronsDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-4 pb-4">
                            <div className="whitespace-pre-wrap text-sm bg-background/80 p-3 rounded border border-muted mt-2">
                              <MarkdownRenderer content={chatResponse.finalResponse} />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )}
                    
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="rounded-lg p-4 bg-muted flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <div>
                            <p className="text-sm font-medium">Processing request</p>
                            <p className="text-xs text-muted-foreground">
                              {chatResponse && chatResponse.toolResults && chatResponse.toolResults.length > 0 
                                ? "Using MCP tools to gather information..." 
                                : "Thinking..."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Move chatEndRef div to the very end to ensure proper scrolling */}
                    <div ref={chatEndRef} className="h-[20px]" /> {/* Added height to ensure there's padding at the bottom */}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="border-t pt-2 pb-2 px-4">
                <form className="w-full space-y-1" onSubmit={handleSubmit}>
                  {error && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <Textarea
                        placeholder="Type your message here...  (Ctrl+Enter to send)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[40px] max-h-[120px] resize-none pr-12 py-2"
                        disabled={isLoading}
                      />
                      <Button 
                        type="submit" 
                        size="sm"
                        className="absolute bottom-2 right-2 p-2 rounded-full h-8 w-8 flex items-center justify-center" 
                        disabled={!message.trim() || isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        {selectedTool && (
                          <Badge variant="outline" className="mr-2">
                            <Code className="h-3 w-3 mr-1" />
                            Using: {selectedTool}
                          </Badge>
                        )}
                        {selectedServer && (
                          <Badge variant="outline" className="mr-2 bg-primary/10">
                            <Cpu className="h-3 w-3 mr-1" />
                            Server: {selectedServer.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </form>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="tools" className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Available Tools
                </CardTitle>
                <CardDescription>Select a tool to generate an example query for your conversation</CardDescription>
              </CardHeader>
              <CardContent>
                {tools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Cpu className="h-12 w-12 mb-4 text-muted" />
                    <h3 className="text-lg font-medium mb-2">No Tools Available</h3>
                    <p className="text-center max-w-md mb-4">The MCP host is not currently connected to any tool servers. Check your connection or try again later.</p>
                    <Alert variant="info" className="max-w-md">
                      <Info className="h-4 w-4" />
                      <AlertTitle>About MCP Tools</AlertTitle>
                      <AlertDescription>
                        Model Context Protocol (MCP) allows AI models to use external tools to perform specific tasks. Once tools are connected, they will appear here.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map((tool) => {
                      const toolInfo = getToolInfo(tool);
                      return (
                        <Card 
                          key={tool} 
                          className={`cursor-pointer transition-all hover:shadow-md ${selectedTool === tool ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => handleToolSelect(tool)}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Code className="h-4 w-4 text-primary" />
                              {toolInfo.name}
                            </CardTitle>
                            <CardDescription>{toolInfo.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="pb-2">
                            <div className="text-sm">
                              <strong className="text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Parameters:
                              </strong>
                              <p className="font-mono text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{toolInfo.parameters}</p>
                            </div>
                          </CardContent>
                          <CardFooter>
                            <div className="text-sm w-full">
                              <span className="text-muted-foreground inline-flex items-center gap-1 mb-1">
                                <MessageSquare className="h-3 w-3" />
                                Example:
                              </span>
                              <p className="italic text-xs bg-primary/10 p-2 rounded w-full">"{toolInfo.example}"</p>
                            </div>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="servers" className="flex-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-primary" />
                  Available Servers
                </CardTitle>
                <CardDescription>Tools grouped by their server origins</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(servers).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Cpu className="h-12 w-12 mb-4 text-muted" />
                    <h3 className="text-lg font-medium mb-2">No Servers Available</h3>
                    <p className="text-center max-w-md mb-4">The MCP host is not currently connected to any servers. Check your connection or try again later.</p>
                    <Alert variant="info" className="max-w-md">
                      <Info className="h-4 w-4" />
                      <AlertTitle>About MCP Servers</AlertTitle>
                      <AlertDescription>
                        Each server provides one or more tools that can be used by the LLM. Servers run as separate processes and communicate with the host using the Model Context Protocol.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{Object.keys(servers).length} Servers</Badge>
                        <Badge variant="outline">{Object.values(servers).flat().length} Tools</Badge>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => fetchServers()}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Refresh
                      </Button>
                    </div>
                    
                    {/* Organize servers by category */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {Object.entries(servers)
                        .sort(([nameA], [nameB]) => {
                          // Sort "other" to the end
                          if (nameA === 'other') return 1;
                          if (nameB === 'other') return -1;
                          // Then sort by number of tools (descending)
                          return servers[nameB].length - servers[nameA].length;
                        })
                        .map(([serverName, serverTools]) => (
                        <div 
                          key={serverName} 
                          className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                            serverName === 'other' ? 'lg:col-span-2 bg-muted/30' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <Cpu className="h-4 w-4 text-primary" />
                              {serverName.charAt(0).toUpperCase() + serverName.slice(1).replace(/_/g, ' ')}
                              <Badge variant="secondary" className="ml-2">{serverTools.length} tool{serverTools.length !== 1 ? 's' : ''}</Badge>
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1"></span>
                                Active
                              </Badge>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="text-xs"
                                onClick={() => handleServerSelect(serverName)}
                              >
                                Use All Tools
                              </Button>
                            </div>
                          </div>
                          
                          <Collapsible defaultOpen={false}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="flex items-center gap-1 mb-2">
                                <ChevronDown className="h-3 w-3" />
                                {serverName === 'other' ? 'Show Miscellaneous Tools' : 'Tool Details'}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                {serverTools
                                  .sort((a, b) => a.localeCompare(b)) // Sort tools alphabetically
                                  .map(tool => {
                                  const toolInfo = getToolInfo(tool);
                                  return (
                                    <Card 
                                      key={tool} 
                                      className="cursor-pointer transition-all hover:shadow-md"
                                      onClick={() => handleToolSelect(tool)}
                                    >
                                      <CardHeader className="py-2 px-3">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <Code className="h-3 w-3 text-primary" />
                                          {toolInfo.name}
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-1 px-3">
                                        <p className="text-xs text-muted-foreground">{toolInfo.description}</p>
                                        <div className="mt-2">
                                          <Button 
                                            variant="secondary" 
                                            size="sm" 
                                            className="w-full text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToolSelect(tool);
                                            }}
                                          >
                                            Use Tool
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            {serverTools.slice(0, 5).map(tool => {
                              return (
                                <Badge 
                                  key={tool}
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-primary/10"
                                  onClick={() => handleToolSelect(tool)}
                                >
                                  {tool}
                                </Badge>
                              );
                            })}
                            {serverTools.length > 5 && (
                              <Badge variant="outline">+{serverTools.length - 5} more</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="border-t py-2 bg-muted/20">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center px-4 gap-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Model Context Protocol (MCP) Host Demo</p>
              <p className="text-xs text-muted-foreground">Integrating LLMs with external tools</p>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Backend</p>
              <p className="text-sm">Node.js/Express</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Frontend</p>
              <p className="text-sm">React + Shadcn/UI</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">LLM</p>
              <p className="text-sm">Anthropic Claude</p>
            </div>
          </div>
        </div>
      </footer>
      
      <Toaster />
    </div>
  );
}

export default App;

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
import { MessageSquare, Lightbulb, Send, Loader2, Bot, Code, ChevronsDown, Info, Cpu, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const chatEndRef = useRef<null | HTMLDivElement>(null);
  const { toast } = useToast();

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

  useEffect(() => {
    fetchTools();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    // Create updated chat history with the new user message
    const newUserMessage: ChatMessage = { role: 'user', content: message };
    const updatedChatHistory: ChatMessage[] = [...chatHistory, newUserMessage];
    
    // Update state with new chat history
    setChatHistory(updatedChatHistory);
    
    // Clear previous response and error
    setResponse(null);
    setError(null);
    setIsLoading(true);

    try {
      // Get the API URL from environment variables
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6754';
      
      // Send the request to the backend with the full API URL
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ history: updatedChatHistory }),
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

      // Clear the message input
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolSelect = (tool: string) => {
    setSelectedTool(tool);
    
    // Generate a template message based on the selected tool
    const toolInfo = getToolInfo(tool);
    setMessage(toolInfo.example);
    toast({
      title: `Tool Selected: ${toolInfo.name}`,
      description: "Example prompt added to message input."
    });
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
      <header className="sticky top-0 z-10 w-full bg-background border-b p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-primary">MCP Host Interface</h1>
          </div>
          <div className="flex items-center space-x-4">
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
        isInputEmpty={!message.trim()}
      />

      <main className="flex-1 container mx-auto p-4 flex flex-col">
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
          </TabsList>
          
          <TabsContent value="chat" className="flex-1 flex flex-col space-y-4">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Chat History
                  </CardTitle>
                  <CardDescription>Interact with the AI assistant using the available tools.</CardDescription>
                </div>
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
                <ScrollArea className="h-[calc(65vh-12rem)] pr-4">
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
                      chatHistory.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div 
                            className={`rounded-lg p-4 max-w-[80%] ${msg.role === 'user' 
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    
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
                              <Button variant="ghost" className="flex w-full justify-between p-4 rounded-lg">
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
                                {chatResponse.toolResults.map((tool, index) => (
                                  <div key={index} className={`rounded-md p-3 border-l-2 ${
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
                                      {tool.result}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </>
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
                    {/* Add final response with visual indicator if available */}
                    {chatResponse && chatResponse.finalResponse && (
                      <div className="flex justify-start w-full">
                        <div className="rounded-lg p-4 bg-primary/15 w-full max-w-[80%] border-l-4 border-primary">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-primary" />
                              <span className="font-semibold text-base">Complete Answer</span>
                            </div>
                            {chatResponse.toolResults && chatResponse.toolResults.length > 0 && (
                              <Badge variant="outline" className="text-xs">Based on {chatResponse.toolResults.length} tool result{chatResponse.toolResults.length > 1 ? 's' : ''}</Badge>
                            )}
                          </div>
                          <div className="whitespace-pre-wrap text-sm bg-background/80 p-3 rounded border border-muted">
                            {chatResponse.finalResponse}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <form className="w-full space-y-2" onSubmit={handleSubmit}>
                  {error && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-col gap-2">
                    <Textarea
                      placeholder="Type your message here...  (Ctrl+Enter to send)"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[80px] resize-none"
                      disabled={isLoading}
                    />
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-muted-foreground">
                        {selectedTool && (
                          <Badge variant="outline" className="mr-2">
                            <Code className="h-3 w-3 mr-1" />
                            Using: {selectedTool}
                          </Badge>
                        )}
                      </div>
                      <Button 
                        type="submit" 
                        className="gap-1 min-w-[100px]" 
                        disabled={!message.trim() || isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send
                          </>
                        )}
                      </Button>
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
        </Tabs>
      </main>
      
      <footer className="border-t py-4 bg-muted/20">
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

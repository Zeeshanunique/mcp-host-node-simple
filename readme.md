# MCP Simple Host

> A simple host application for MCP that show how easy integration with generateText, experimental_createMCPClient of @ai-sdk. Currently, only tested for Anthropic LLM.

## Environment

Before running the application, you need to set up the following environment variables in a `.env` file at the root of the project:

```bash
# Required API key for Anthropic
ANTHROPIC_API_KEY=your_api_key_here

# Server Configuration
NODE_ENV=development  # Use 'production' for production mode
BACKEND_PORT=3001     # Port for the backend server
FRONTEND_PORT=3002    # Port for the frontend React application
FRONTEND_URL=http://localhost:3002
CORS_ORIGINS=*

# MCP Configuration
MCP_CONFIG_PATH=./mcp-servers.json

# Logging
LOG_LEVEL=info  # Options: trace, debug, info, warn, error, fatal

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

## Running the Application

1. Install all dependencies (backend and frontend):
```bash
npm run install:all
```

2. Development Mode:
```bash
npm run dev:all
```
This will build the TypeScript code and start both the backend server (port 3001) and frontend development server (port 3002).

3. Production Mode:
```bash
npm run prod:all
```
This builds both the backend and frontend for production and starts only the backend server, which serves the frontend static files.

## MCP Tools Configuration

The MCP server list can be configured through the `mcp-servers.json` file. Example MCP servers are provided in the 'fixtures/servers' directory:

- `calc`: Simple calculator functions
- `websearch`: Web search capability
- `research`: Research assistant
- `weather`: Weather information
- `summarize`: Text summarization
- `travel_guide`: Travel guides and recommendations
- `webscrap`: Web scraping functionality
- `brave-search`: Integration with Brave Search
- `playwright-mcp-server`: Browser automation with Playwright

## Project Structure

- `src/backend`: Backend server code
- `src/frontend`: React frontend application
- `fixtures/servers`: Sample MCP server implementations
- `src/mcp-host.ts`: Main MCP host implementation
- `src/llm-client.ts`: LLM client for communicating with Anthropic

## Environment-Specific Configuration

You can create environment-specific configuration files:
- `.env.development` for development environment
- `.env.production` for production environment

The application will load these files based on the NODE_ENV value.

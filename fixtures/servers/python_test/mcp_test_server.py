#!/usr/bin/env python3
import json
import sys
import traceback

# Simple MCP server implementation in Python
class SimpleMCPServer:
    def __init__(self):
        self.tools = {
            "python_echo": {
                "schema": {
                    "type": "function",
                    "function": {
                        "name": "python_echo",
                        "description": "Echoes back the message from Python",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "message": {
                                    "type": "string",
                                    "description": "The message to echo"
                                }
                            },
                            "required": ["message"]
                        }
                    }
                },
                "handler": self.echo_handler
            },
            "python_add": {
                "schema": {
                    "type": "function",
                    "function": {
                        "name": "python_add",
                        "description": "Adds two numbers together using Python",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "a": {
                                    "type": "number",
                                    "description": "First number"
                                },
                                "b": {
                                    "type": "number",
                                    "description": "Second number"
                                }
                            },
                            "required": ["a", "b"]
                        }
                    }
                },
                "handler": self.add_handler
            }
        }
        
    def echo_handler(self, params):
        message = params.get("message", "")
        return {
            "content": [{"type": "text", "text": f"Python echo: {message}"}]
        }
        
    def add_handler(self, params):
        a = params.get("a", 0)
        b = params.get("b", 0)
        return {
            "content": [{"type": "text", "text": f"Python calculation: {a} + {b} = {a + b}"}]
        }
    
    def send_response(self, res_id, data):
        response = {
            "jsonrpc": "2.0",
            "id": res_id,
            "result": data
        }
        print(json.dumps(response), flush=True)
    
    def send_error(self, res_id, error_code, message):
        response = {
            "jsonrpc": "2.0",
            "id": res_id,
            "error": {
                "code": error_code,
                "message": message
            }
        }
        print(json.dumps(response), flush=True)
    
    def process_message(self, message):
        try:
            req_id = message.get("id")
            method = message.get("method")
            
            if method == "mcp.list_tools":
                tool_schemas = {name: tool["schema"] for name, tool in self.tools.items()}
                self.send_response(req_id, {"tools": tool_schemas})
            
            elif method == "mcp.execute_tool":
                params = message.get("params", {})
                tool_name = params.get("name")
                tool_params = params.get("parameters", {})
                
                if tool_name in self.tools:
                    try:
                        result = self.tools[tool_name]["handler"](tool_params)
                        self.send_response(req_id, result)
                    except Exception as e:
                        self.send_error(req_id, -32000, f"Error executing tool: {str(e)}")
                else:
                    self.send_error(req_id, -32601, f"Tool not found: {tool_name}")
            
            else:
                self.send_error(req_id, -32601, f"Method not found: {method}")
                
        except Exception as e:
            error_message = f"Error processing message: {str(e)}\n{traceback.format_exc()}"
            self.send_error(message.get("id", None), -32000, error_message)
    
    def run(self):
        # Log startup to stderr
        print("Python MCP test server started", file=sys.stderr)
        
        # Process input line by line
        for line in sys.stdin:
            line = line.strip()
            if line:
                try:
                    message = json.loads(line)
                    self.process_message(message)
                except json.JSONDecodeError:
                    print(f"Error: Invalid JSON: {line}", file=sys.stderr)

if __name__ == "__main__":
    server = SimpleMCPServer()
    server.run() 
from typing import Dict, Any, Optional
import logging
from pythonjsonlogger import jsonlogger
import sys
from config import Settings
from fastmcp import FastMCP

# Load settings
settings = Settings()

# Configure JSON logging
logger = logging.getLogger()
logHandler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter() if settings.JSON_LOGS else logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(settings.LOG_LEVEL)

# Initialize FastMCP server
mcp = FastMCP("fastmcp-test")

class TestRequest:
    test_id: str
    parameters: Dict[str, Any]
    expected_result: Optional[Any] = None

@mcp.tool()
async def run_test(test_id: str, parameters: Dict[str, Any], expected_result: Optional[Any] = None) -> Dict[str, Any]:
    """Run a test with the given parameters and compare with expected result.
    
    Args:
        test_id: Unique identifier for the test
        parameters: Dictionary of test parameters
        expected_result: Optional expected result to compare against
    """
    try:
        logger.info(f"Running test {test_id}", extra={
            "test_id": test_id,
            "parameters": parameters
        })
        
        # Implement test logic here
        # For now, just echo back the parameters
        result = parameters
        success = True
        message = "Test completed successfully"
        
        return {
            "test_id": test_id,
            "result": result,
            "success": success,
            "message": message
        }
    except Exception as e:
        logger.error(f"Test {test_id} failed", extra={
            "test_id": test_id,
            "error": str(e)
        })
        raise

@mcp.tool()
async def health_check() -> Dict[str, str]:
    """Check the health status of the server."""
    return {"status": "healthy"}

if __name__ == "__main__":
    # Initialize and run the server with stdio transport
    mcp.run(transport='stdio') 
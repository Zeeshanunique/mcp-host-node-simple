from typing import Dict, Any, Optional
import logging
from pythonjsonlogger import jsonlogger
import sys
from config import Settings
from fastmcp import FastMCP
from pydantic import BaseModel, Field

# Load settings
settings = Settings()

# Configure JSON logging
logger = logging.getLogger()
logHandler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter() if settings.JSON_LOGS else logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(settings.LOG_LEVEL.upper())  # Convert to uppercase for compatibility

# Initialize FastMCP server with detailed instructions
mcp = FastMCP(
    name="fastmcp-test",
    instructions="""
    # FastMCP Test Server

    This server provides tools for testing and validating MCP functionality.

    ## Tools

    ### run_test
    - Purpose: Run a test with given parameters and compare with expected results
    - Use when: You need to validate functionality or compare actual vs expected results
    - Parameters:
      * test_id: Unique identifier for the test
      * parameters: Dictionary of test parameters
      * expected_result: Optional expected result to compare against

    ### health_check
    - Purpose: Check the health status of the server
    - Use when: You need to verify the server is operational
    - Returns: Server health status

    ## Best Practices
    - Always provide a unique test_id for traceability
    - Include expected_result when possible for validation
    - Check health_check before running critical tests
    - Handle errors gracefully using try-except blocks

    ## Error Handling
    - All errors are logged with test_id for tracking
    - Failed tests return detailed error messages
    - Health check failures indicate server issues
    """
)

class TestRequest(BaseModel):
    """Request model for test execution."""
    test_id: str = Field(..., description="Unique identifier for the test")
    parameters: Dict[str, Any] = Field(..., description="Dictionary of test parameters")
    expected_result: Optional[Any] = Field(None, description="Optional expected result to compare against")

class TestResponse(BaseModel):
    """Response model for test results."""
    test_id: str = Field(..., description="Test identifier")
    result: Any = Field(..., description="Test result")
    success: bool = Field(..., description="Whether the test was successful")
    message: str = Field(..., description="Result message")

@mcp.tool()
async def run_test(test_id: str, parameters: Dict[str, Any], expected_result: Optional[Any] = None) -> Dict[str, Any]:
    """Run a test with the given parameters and compare with expected result.
    
    Args:
        test_id: Unique identifier for the test
        parameters: Dictionary of test parameters
        expected_result: Optional expected result to compare against
        
    Returns:
        Dictionary containing test results and status
        
    Raises:
        Exception: If test execution fails
    """
    try:
        logger.info(f"Running test {test_id}", extra={
            "test_id": test_id,
            "parameters": parameters,
            "has_expected_result": expected_result is not None
        })
        
        # Implement test logic here
        # For now, just echo back the parameters
        result = parameters
        
        # Compare with expected result if provided
        success = True
        if expected_result is not None:
            success = result == expected_result
            message = "Test completed successfully" if success else "Test failed: result does not match expected"
        else:
            message = "Test completed successfully"
        
        response = TestResponse(
            test_id=test_id,
            result=result,
            success=success,
            message=message
        )
        
        logger.info(f"Test {test_id} completed", extra={
            "test_id": test_id,
            "success": success,
            "message": message
        })
        
        return response.dict()
        
    except Exception as e:
        logger.error(f"Test {test_id} failed", extra={
            "test_id": test_id,
            "error": str(e),
            "error_type": type(e).__name__
        })
        raise

@mcp.tool()
async def health_check() -> Dict[str, str]:
    """Check the health status of the server.
    
    Returns:
        Dictionary containing server health status
    """
    try:
        # Add any additional health checks here
        status = "healthy"
        logger.info("Health check passed")
    except Exception as e:
        status = "unhealthy"
        logger.error(f"Health check failed: {str(e)}")
    
    return {"status": status}

if __name__ == "__main__":
    logger.info("Starting FastMCP test server")
    # Initialize and run the server with stdio transport
    mcp.run(transport='stdio') 
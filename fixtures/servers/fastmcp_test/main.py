from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging
from pythonjsonlogger import jsonlogger
import sys
from config import Settings

# Load settings
settings = Settings()

# Configure JSON logging
logger = logging.getLogger()
logHandler = logging.StreamHandler(sys.stdout)
formatter = jsonlogger.JsonFormatter() if settings.JSON_LOGS else logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logHandler.setFormatter(formatter)
logger.addHandler(logHandler)
logger.setLevel(settings.LOG_LEVEL)

app = FastAPI(
    title="FastMCP Test Server",
    description="A test server for FastMCP functionality",
    version=settings.API_VERSION,
    debug=settings.DEBUG,
    docs_url=f"{settings.API_PREFIX}/docs",
    openapi_url=f"{settings.API_PREFIX}/openapi.json"
)

class TestRequest(BaseModel):
    test_id: str
    parameters: Dict[str, Any]
    expected_result: Optional[Any] = None

class TestResponse(BaseModel):
    test_id: str
    result: Any
    success: bool
    message: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "FastMCP Test Server is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/test", response_model=TestResponse)
async def run_test(request: TestRequest):
    try:
        logger.info(f"Running test {request.test_id}", extra={
            "test_id": request.test_id,
            "parameters": request.parameters
        })
        
        # Implement test logic here
        # For now, just echo back the parameters
        result = request.parameters
        success = True
        message = "Test completed successfully"
        
        return TestResponse(
            test_id=request.test_id,
            result=result,
            success=success,
            message=message
        )
    except Exception as e:
        logger.error(f"Test {request.test_id} failed", extra={
            "test_id": request.test_id,
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.HOST, 
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower()
    ) 
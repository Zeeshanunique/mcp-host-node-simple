from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # API settings
    API_VERSION: str = "v1"
    API_PREFIX: str = f"/api/{API_VERSION}"
    
    # Logging settings
    LOG_LEVEL: str = "INFO"
    JSON_LOGS: bool = True
    
    # Test settings
    MAX_TEST_DURATION: int = 300  # Maximum test duration in seconds
    MAX_CONCURRENT_TESTS: int = 10
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings() 
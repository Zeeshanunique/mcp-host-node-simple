from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = False
    
    # API settings
    API_VERSION: str = "v1"
    API_PREFIX: str = f"/api/{API_VERSION}"
    
    # Logging settings
    LOG_LEVEL: str = "INFO"
    JSON_LOGS: bool = True
    
    # Date format settings
    DEFAULT_DATE_FORMAT: str = "%Y-%m-%d"  # ISO format (YYYY-MM-DD)
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"  # Allow extra fields from environment
    } 
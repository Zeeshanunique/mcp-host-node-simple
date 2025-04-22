from typing import Dict, Any, Optional
import logging
from pythonjsonlogger import jsonlogger
import sys
from datetime import datetime, date
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

# Convert log level to uppercase for compatibility
log_level = settings.LOG_LEVEL.upper()
logger.setLevel(log_level)

# Initialize FastMCP server with detailed instructions
mcp = FastMCP(
    name="age-calculator",
    log_level=log_level,
    instructions="""
    # Age Calculator MCP Server

    This server provides tools for calculating age based on birthdate.

    ## Tools

    ### calculate_age
    - Purpose: Calculate a person's age based on their birthdate
    - Use when: You need to determine someone's age from a birthdate
    - Parameters:
      * birthdate: The person's date of birth (format: YYYY-MM-DD)
      * reference_date: Optional reference date for age calculation (default: current date)

    ### health_check
    - Purpose: Check the health status of the server
    - Use when: You need to verify the server is operational
    - Returns: Server health status

    ## Best Practices
    - Always provide birthdates in YYYY-MM-DD format
    - Reference date is optional - if not provided, the current date will be used
    - Age is calculated as full years completed, not just calendar year difference
    - Handle errors gracefully using try-except blocks

    ## Examples
    - calculate_age(birthdate="1990-05-15") - Age as of today
    - calculate_age(birthdate="1990-05-15", reference_date="2020-01-01") - Age as of Jan 1, 2020
    """
)

class AgeCalculationRequest(BaseModel):
    """Request model for age calculation."""
    birthdate: str = Field(..., description="Birthdate in YYYY-MM-DD format")
    reference_date: Optional[str] = Field(None, description="Reference date for calculation (default: today)")

class AgeCalculationResponse(BaseModel):
    """Response model for age calculation results."""
    birthdate: str = Field(..., description="The provided birthdate")
    reference_date: str = Field(..., description="The reference date used for calculation")
    age: int = Field(..., description="Calculated age in years")
    age_months: int = Field(..., description="Additional months beyond full years")
    age_days: int = Field(..., description="Additional days beyond months")
    next_birthday: str = Field(..., description="Date of next birthday after reference date")
    days_to_next_birthday: int = Field(..., description="Days until next birthday")

def parse_date(date_str: str, date_format: str = None) -> date:
    """Parse a date string into a date object."""
    if date_format is None:
        date_format = settings.DEFAULT_DATE_FORMAT
    
    try:
        return datetime.strptime(date_str, date_format).date()
    except ValueError as e:
        raise ValueError(f"Invalid date format. Please use {date_format}: {e}")

def calculate_age_components(birthdate: date, reference_date: date) -> Dict[str, Any]:
    """Calculate detailed age components (years, months, days)."""
    if birthdate > reference_date:
        raise ValueError("Birthdate cannot be in the future")
    
    years = reference_date.year - birthdate.year
    
    # Adjust if birthday hasn't occurred yet this year
    if (reference_date.month, reference_date.day) < (birthdate.month, birthdate.day):
        years -= 1
    
    # Calculate months and days
    if reference_date.day >= birthdate.day:
        months = reference_date.month - birthdate.month
        days = reference_date.day - birthdate.day
    else:
        # Get days in the previous month of reference_date
        if reference_date.month == 1:
            prev_month = 12
            prev_month_year = reference_date.year - 1
        else:
            prev_month = reference_date.month - 1
            prev_month_year = reference_date.year
            
        prev_month_days = (date(prev_month_year, prev_month + 1, 1) if prev_month < 12 
                          else date(prev_month_year + 1, 1, 1)).toordinal() - date(prev_month_year, prev_month, 1).toordinal()
        
        months = reference_date.month - birthdate.month - 1
        if months < 0:
            months += 12
            years -= 1
        
        days = reference_date.day + (prev_month_days - birthdate.day)
    
    # Calculate next birthday
    next_birthday_year = reference_date.year
    if (reference_date.month, reference_date.day) >= (birthdate.month, birthdate.day):
        next_birthday_year += 1
    
    try:
        next_birthday = date(next_birthday_year, birthdate.month, birthdate.day)
    except ValueError:
        # Handle Feb 29 for non-leap years
        if birthdate.month == 2 and birthdate.day == 29:
            next_birthday = date(next_birthday_year, 3, 1)
        else:
            raise
    
    days_to_next_birthday = (next_birthday - reference_date).days
    
    return {
        "age": years,
        "age_months": months,
        "age_days": days,
        "next_birthday": next_birthday.strftime(settings.DEFAULT_DATE_FORMAT),
        "days_to_next_birthday": days_to_next_birthday
    }

@mcp.tool()
async def calculate_age(birthdate: str, reference_date: Optional[str] = None) -> Dict[str, Any]:
    """Calculate a person's age based on their birthdate.
    
    Args:
        birthdate: Date of birth in YYYY-MM-DD format
        reference_date: Optional reference date for calculation in YYYY-MM-DD format (default: today)
        
    Returns:
        Dictionary containing age and related information
        
    Raises:
        ValueError: If dates are invalid or birthdate is in the future
    """
    try:
        logger.info(f"Calculating age for birthdate: {birthdate}", extra={
            "birthdate": birthdate,
            "reference_date": reference_date
        })
        
        birth_date = parse_date(birthdate)
        
        # Use current date if reference_date is not provided
        if reference_date is None:
            ref_date = date.today()
            reference_date = ref_date.strftime(settings.DEFAULT_DATE_FORMAT)
        else:
            ref_date = parse_date(reference_date)
        
        # Calculate age components
        result = calculate_age_components(birth_date, ref_date)
        
        # Prepare response
        response = AgeCalculationResponse(
            birthdate=birthdate,
            reference_date=reference_date,
            **result
        )
        
        logger.info(f"Age calculation completed: {result['age']} years", extra={
            "birthdate": birthdate,
            "reference_date": reference_date,
            "age": result["age"]
        })
        
        return response.dict()
        
    except Exception as e:
        logger.error(f"Age calculation failed", extra={
            "birthdate": birthdate,
            "reference_date": reference_date,
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
    logger.info("Starting Age Calculator MCP server")
    # Initialize and run the server with stdio transport
    mcp.run(transport='stdio') 
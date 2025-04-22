# Age Calculator MCP Server

An MCP server implementation for calculating age based on birthdate. This server provides tools for accurately determining a person's age, including years, months, days, and information about the next birthday.

## Features

- Calculate precise age in years, months, and days
- Determine date of next birthday and days until next birthday
- Handle leap years and special date cases
- Provide health check endpoint

## Installation

1. Ensure you have Python installed (3.7 or later recommended)
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Install UVX directly:
   ```
   pip install uvx==1.0.0
   ```

## Running the Server

### With UVX (Recommended)
```
uvx main.py
```

### With Python (Fallback)
```
python main.py
```

## Usage

The server provides the following tools:

### calculate_age
Calculates age based on birthdate.

Parameters:
- `birthdate`: Date of birth in YYYY-MM-DD format
- `reference_date`: Optional reference date for calculation (default: today)

Example:
```
calculate_age(birthdate="1990-05-15")
calculate_age(birthdate="1990-05-15", reference_date="2020-01-01")
```

Response:
```json
{
  "birthdate": "1990-05-15",
  "reference_date": "2023-04-22",
  "age": 32,
  "age_months": 11,
  "age_days": 7,
  "next_birthday": "2023-05-15",
  "days_to_next_birthday": 23
}
```

### health_check
Checks the server's health status.

Example:
```
health_check()
```

Response:
```json
{
  "status": "healthy"
}
```

## Integration with MCP Host

This server is configured in `mcp-servers.json` to run with UVX. When the main MCP host application starts, it will automatically start this server and make its tools available. 
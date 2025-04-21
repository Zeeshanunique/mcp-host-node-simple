# AWS CDK Stack Cost Analyzer

A tool for analyzing AWS CDK stacks and estimating infrastructure costs.

## Overview

The AWS CDK Stack Cost Analyzer parses CDK synthesized templates or CloudFormation templates to extract resource information, estimate usage patterns, and calculate the potential cost of your infrastructure.

Key features:
- Analyze CDK stack templates for cost estimation
- Calculate costs across multiple AWS services
- Apply Free Tier benefits and cost optimizations
- Generate detailed cost reports
- CLI tool for easy integration

## Installation

```bash
# Clone the repository
git clone [repository-url]
cd aws-cost-analysis-mcp

# Install dependencies
npm install

# Make the CLI executable
chmod +x ./cli.js

# Link the CLI tool (optional)
npm link
```

## Usage

### Command Line Interface

The AWS CDK Stack Cost Analyzer provides a command-line interface for analyzing CDK stacks and generating cost reports.

```bash
# Analyze a CDK stack template
aws-cost-analyzer analyze path/to/template.json

# Generate a cost report
aws-cost-analyzer report path/to/analysis-results.json -o cost-report.md

# Show help
aws-cost-analyzer --help
```

### Options for `analyze` command

```
Options:
  -o, --output <file>       Output file for the analysis results (JSON)
  -r, --report <file>       Generate a cost report (Markdown)
  -a, --assumptions <file>  JSON file with usage assumptions
  -f, --free-tier           Apply free tier discounts (default: true)
  -t, --include-template    Include the template in the output
  -s, --summary             Print a summary to the console (default: true)
  -h, --help                Display help
```

### Options for `report` command

```
Options:
  -o, --output <file>     Output file for the report
  -f, --format <format>   Report format (markdown) (default: "markdown")
  -h, --help              Display help
```

## Supported Services

The cost analyzer currently supports the following AWS services:

- AWS Lambda
- Amazon S3
- Amazon DynamoDB
- Amazon API Gateway
- Amazon EC2
- AWS CloudFront
- Amazon RDS
- Amazon SQS
- Amazon SNS

## Custom Usage Assumptions

You can provide custom usage assumptions to get more accurate cost estimates. Create a JSON file with your assumptions and pass it to the analyzer using the `-a` option.

Example assumptions file:

```json
{
  "Lambda": {
    "avg_monthly_requests": 5000000,
    "avg_memory_size": 256,
    "avg_duration_ms": 800
  },
  "S3": {
    "storage_gb": 500,
    "monthly_get_requests": 1000000,
    "monthly_put_requests": 200000
  },
  "DynamoDB": {
    "storage_gb": 50,
    "provisioned_mode": false,
    "monthly_read_request_units": 2000000,
    "monthly_write_request_units": 1000000
  }
}
```

## API Usage

You can also use the analyzer programmatically in your code:

```javascript
import { analyzeCdkStack } from './cdk_analyzer.js';
import { generateCostReport } from './report_generator.js';

// Analyze a CDK stack
const results = await analyzeCdkStack('path/to/template.json', {
  applyFreeTier: true,
  usageAssumptions: { /* your assumptions */ }
});

// Generate a cost report
const report = await generateCostReport(results, {
  outputFormat: 'markdown',
  outputDir: 'reports',
  fileName: 'cost-report.md'
});
```

## Limitations

- Cost estimates are based on current AWS pricing which may change over time
- Resource usage patterns are estimated and actual costs may vary
- Not all AWS services and resource types are supported
- The analyzer does not account for special pricing arrangements or reserved instances

## License

MIT 
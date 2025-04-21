# AWS Architecture Cost Analysis

This tool analyzes and compares the costs between different AWS architecture approaches, specifically:
- EC2-based architectures
- Container-based architectures

## Files

- `cdk_analyzer.js` - Core analyzer that processes CloudFormation/CDK templates and estimates costs
- `compare_architectures.js` - Script that compares EC2-based and container-based architectures
- `templates/` - Directory containing sample CloudFormation templates
  - `ec2_template.json` - Template for EC2-based microservice architecture
  - `container_template.json` - Template for container-based microservice architecture

## How to Run

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Running the Comparison Analysis

On Windows:
```
node fixtures/servers/aws_cost_analysis/compare_architectures.js
```

On Linux/MacOS:
```
node fixtures/servers/aws_cost_analysis/compare_architectures.js
# Or using the executable directly
./fixtures/servers/aws_cost_analysis/compare_architectures.js
```

### Sample Output

The comparison will generate:

1. Overall cost comparison between architectures
2. Service-by-service cost breakdown
3. Resource count comparison
4. Cost optimization recommendations

## How it Works

The analyzer:
1. Parses CloudFormation templates
2. Identifies AWS resources and their configurations
3. Maps resources to services
4. Estimates costs based on typical usage patterns and AWS pricing
5. Generates comparative analysis between architectures

## Customization

To analyze your own templates:
1. Replace the templates in the `templates/` directory with your own
2. Update the paths in `compare_architectures.js` if needed
3. Adjust the analysis options as necessary:
   ```javascript
   const analysisOptions = {
     region: 'us-east-1',  // Change to your target region
     duration: 30,         // Analysis duration in days
     includeDetailedBreakdown: true
   };
   ```

## Limitations

- Cost estimates are approximations based on typical usage patterns
- Actual costs will vary based on real-world usage, data transfer, and other factors
- The tool does not account for all AWS pricing dimensions (e.g., data transfer costs)
- Reserved instance discounts are not automatically applied in the analysis

## Future Improvements

- Add support for more AWS services
- Incorporate reserved instance pricing
- Add support for Terraform templates
- Include detailed data transfer cost estimates
- Implement a web-based UI for easier analysis 
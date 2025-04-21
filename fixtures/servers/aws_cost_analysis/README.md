# AWS Cost Analysis MCP Server

The AWS Cost Analysis MCP Server provides functionality for analyzing AWS CloudFormation and CDK stack templates to estimate costs and compare different architecture options.

## Features

- **Single Template Analysis**: Analyze a CloudFormation/CDK template to estimate monthly costs
- **Architecture Comparison**: Compare costs between different architecture options
- **Cost Optimization Recommendations**: Get recommendations for reducing costs
- **HTML Report Generation**: Generate detailed HTML reports with cost breakdowns
- **Resource Utilization Analysis**: Understand resource usage and potential savings

## Usage

### Analyzing a Template

To analyze a single CloudFormation or CDK template:

```javascript
const result = await analyze_template({
  templatePath: 'templates/serverless_template.json',
  name: 'Serverless Architecture',
  region: 'us-east-1',
  options: {
    includeSavingsPlans: true,
    includeReservedInstances: false,
    assumedUtilization: 0.7
  }
});
```

### Comparing Architectures

To compare costs between different architecture templates:

```javascript
const result = await compare_architectures({
  templates: [
    {
      path: 'templates/serverless_template.json',
      name: 'Serverless Architecture'
    },
    {
      path: 'templates/container_template.json',
      name: 'Container Architecture'
    }
  ],
  generateHtml: true,
  options: {
    region: 'us-east-1',
    reportTitle: 'Serverless vs Container Architecture Comparison',
    reportPath: 'reports/comparison_report.html'
  }
});
```

### Saving a Template

To save a new CloudFormation/CDK template for analysis:

```javascript
const result = await save_template({
  content: JSON.stringify(templateObject),
  filename: 'new_template.json',
  overwrite: false
});
```

### Listing Available Templates

To list all available templates for analysis:

```javascript
const result = await list_templates();
```

## API Reference

### analyze_template(params)

Analyzes a single CloudFormation/CDK template for cost estimation.

**Parameters:**

- `params.templatePath` (string): Path to the template file
- `params.name` (string, optional): Name for the architecture
- `params.region` (string, optional): AWS region (default: 'us-east-1')
- `params.options` (object, optional):
  - `includeSavingsPlans` (boolean): Consider Savings Plans in cost calculations
  - `includeReservedInstances` (boolean): Consider Reserved Instances in cost calculations
  - `assumedUtilization` (number): Assumed resource utilization (0-1)
  - `includeRecommendations` (boolean): Include optimization recommendations
  - `additionalDetails` (boolean): Include additional resource details

**Returns:**

Object containing the analysis results.

### compare_architectures(params)

Compares costs between different architecture templates.

**Parameters:**

- `params.templates` (array): Array of template objects
  - `path` (string): Path to the template file
  - `name` (string): Name for the architecture
  - `region` (string, optional): AWS region
- `params.generateHtml` (boolean, optional): Generate an HTML report
- `params.options` (object, optional):
  - `region` (string): Default AWS region
  - `reportTitle` (string): Title for the HTML report
  - `reportPath` (string): Path to save the HTML report

**Returns:**

Object containing the comparison results and optionally the HTML report.

### save_template(params)

Saves a template to the templates directory.

**Parameters:**

- `params.content` (string): Template content
- `params.filename` (string): Filename to save as
- `params.overwrite` (boolean, optional): Overwrite if file exists

**Returns:**

Object containing information about the saved template.

### list_templates()

Lists all available templates.

**Returns:**

Object containing the list of templates.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
# {{title}}

*Generated on: {{generatedDate}}*

## Overview

This report provides a cost comparison between different architecture approaches for deploying microservices:

{{#each stacks}}
- **{{name}}**: {{analysis.stackName}}
{{/each}}

## Cost Summary

| Architecture | Total Monthly Cost | Annual Cost |
|--------------|-------------------:|------------:|
{{#each stacks}}
| {{name}} | ${{formatNumber analysis.estimatedCost.monthlyCost}} | ${{formatNumber (multiply analysis.estimatedCost.monthlyCost 12)}} |
{{/each}}

## Cost Comparison by Metric

{{#each comparisonMetrics}}
### {{name}}

*{{description}}*

| Architecture | Cost |
|--------------|-----:|
{{#each ../stacks}}
| {{name}} | ${{formatNumber (lookup ../this this)}} |
{{/each}}

{{/each}}

## Service Breakdown by Architecture

{{#each stacks}}
### {{name}} Service Costs

| Service | Monthly Cost | Percentage |
|---------|-------------:|-----------:|
{{#each analysis.serviceCosts}}
| {{service}} | ${{formatNumber monthlyCost}} | {{formatNumber percentage}}% |
{{/each}}
| **Total** | **${{formatNumber analysis.estimatedCost.monthlyCost}}** | **100%** |

{{/each}}

## Resource Details

{{#each stacks}}
### {{name}} Resources

{{#each analysis.resourceDetails}}
#### {{resourceType}} ({{count}} resources)
{{#if details}}
{{#each details}}
- {{name}}: {{#each attributes}}{{@key}}: {{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/each}}
{{/if}}

{{/each}}

{{/each}}

## Cost Optimization Recommendations

{{#each stacks}}
### {{name}} Optimization Opportunities

{{#if analysis.recommendations}}
{{#each analysis.recommendations}}
- **{{category}}**: {{description}}
  {{#if potentialSavings}}*Potential monthly savings: ${{formatNumber potentialSavings}}*{{/if}}
{{/each}}
{{else}}
No specific optimization recommendations.
{{/if}}

{{/each}}

## Conclusion

{{conclusion}}

---

*This report is an estimation based on the resources defined in CloudFormation templates and approximate AWS pricing. Actual costs may vary based on usage patterns, AWS promotions, and service tier changes. All costs are in USD.* 
#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { analyzeCdkStack } = require('./cdk_analyzer');
const { generateReport } = require('./report_generator');

async function runComparison() {
  console.log('AWS CDK Stack Cost Analyzer - Template Comparison Example');
  console.log('====================================================\n');

  try {
    // Path to template files
    const ec2TemplatePath = path.join(__dirname, 'templates', 'ec2_template.json');
    const containerTemplatePath = path.join(__dirname, 'templates', 'container_template.json');

    // Analyze EC2-based architecture
    console.log('Analyzing EC2-based microservices architecture...');
    const ec2Analysis = await analyzeCdkStack(ec2TemplatePath, {
      region: 'us-east-1',
      includeDetails: true
    });

    // Analyze container-based architecture
    console.log('Analyzing container-based microservices architecture...');
    const containerAnalysis = await analyzeCdkStack(containerTemplatePath, {
      region: 'us-east-1',
      includeDetails: true
    });

    // Generate comparison report
    console.log('Generating cost comparison report...');
    
    const reportOptions = {
      title: 'Architecture Cost Comparison: EC2 vs. Containers',
      outputFormat: 'markdown',
      outputPath: path.join(__dirname, 'comparison-report.md')
    };

    // Create comparison data
    const comparisonData = {
      stacks: [
        {
          name: 'EC2 Microservices',
          analysis: ec2Analysis
        },
        {
          name: 'Container Microservices',
          analysis: containerAnalysis
        }
      ],
      comparisonMetrics: [
        {
          name: 'Total Monthly Cost',
          description: 'Estimated total monthly cost in USD',
          getValue: (analysis) => analysis.estimatedCost.monthlyCost
        },
        {
          name: 'Compute Costs',
          description: 'Monthly cost for compute resources (EC2 or Fargate)',
          getValue: (analysis) => {
            const ec2Costs = analysis.serviceCosts.find(s => s.service === 'EC2')?.monthlyCost || 0;
            const fargateCosts = analysis.serviceCosts.find(s => s.service === 'ECS')?.monthlyCost || 0;
            return ec2Costs + fargateCosts;
          }
        },
        {
          name: 'Storage Costs',
          description: 'Monthly cost for storage (S3, EBS)',
          getValue: (analysis) => {
            const s3Costs = analysis.serviceCosts.find(s => s.service === 'S3')?.monthlyCost || 0;
            const ebsCosts = analysis.serviceCosts.find(s => s.service === 'EBS')?.monthlyCost || 0;
            return s3Costs + ebsCosts;
          }
        },
        {
          name: 'Database Costs',
          description: 'Monthly cost for database services',
          getValue: (analysis) => {
            return analysis.serviceCosts.find(s => s.service === 'DynamoDB')?.monthlyCost || 0;
          }
        },
        {
          name: 'Network Costs',
          description: 'Monthly cost for networking resources',
          getValue: (analysis) => {
            return (analysis.serviceCosts.find(s => s.service === 'ELB')?.monthlyCost || 0) +
                   (analysis.serviceCosts.find(s => s.service === 'NATGateway')?.monthlyCost || 0);
          }
        }
      ]
    };

    // Generate and save the report
    const report = await generateReport(comparisonData, reportOptions);
    
    fs.writeFileSync(reportOptions.outputPath, report);
    
    console.log(`\nReport generated successfully at: ${reportOptions.outputPath}`);
    console.log('\nComparison Summary:');
    console.log(`EC2 Architecture Total Cost: $${ec2Analysis.estimatedCost.monthlyCost.toFixed(2)} per month`);
    console.log(`Container Architecture Total Cost: $${containerAnalysis.estimatedCost.monthlyCost.toFixed(2)} per month`);
    
    const difference = ec2Analysis.estimatedCost.monthlyCost - containerAnalysis.estimatedCost.monthlyCost;
    const percentage = (Math.abs(difference) / ec2Analysis.estimatedCost.monthlyCost) * 100;
    
    if (difference > 0) {
      console.log(`\nContainer architecture is $${difference.toFixed(2)} (${percentage.toFixed(1)}%) cheaper per month`);
    } else if (difference < 0) {
      console.log(`\nEC2 architecture is $${Math.abs(difference).toFixed(2)} (${percentage.toFixed(1)}%) cheaper per month`);
    } else {
      console.log('\nBoth architectures have the same estimated cost');
    }
    
  } catch (error) {
    console.error('Error running comparison:', error);
    process.exit(1);
  }
}

// Run the comparison
runComparison(); 
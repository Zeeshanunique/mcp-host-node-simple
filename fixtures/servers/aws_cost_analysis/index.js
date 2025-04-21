#!/usr/bin/env node

/**
 * AWS Cost Analysis MCP Server
 * 
 * This server provides cost analysis capabilities for AWS architectures
 * through the Model Context Protocol (MCP).
 */

import { createServer } from '@modelcontextprotocol/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeCdkStack } from './cdk_analyzer.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define paths to template directories
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Create a new MCP server
const server = createServer({
  serverName: 'mcp_AWS_Cost_Analysis',
  defaultTimeout: 30000,
});

// Define a function to analyze a template and return the results
async function analyzeTemplate(templatePath, options = {}) {
  try {
    const result = await analyzeCdkStack(templatePath, {
      region: options.region || 'us-east-1',
      duration: options.duration || 30,
      includeDetailedBreakdown: true,
      ...options
    });
    
    return result;
  } catch (error) {
    return {
      error: error.message,
      success: false
    };
  }
}

// Register the template analysis action
server.tools.registerAction({
  name: 'analyze_template',
  description: 'Analyzes a CloudFormation/CDK template and provides a cost estimate',
  inputSchema: {
    type: 'object',
    properties: {
      template: {
        type: 'string',
        description: 'The name of the template to analyze: "ec2_template", "container_template", or "serverless_template"'
      },
      region: {
        type: 'string',
        description: 'AWS region to use for pricing (default: us-east-1)'
      },
      duration: {
        type: 'number',
        description: 'Duration in days for cost calculation (default: 30)'
      }
    },
    required: ['template']
  },
  handler: async ({ template, region, duration }) => {
    let templatePath;
    
    // Determine the template path based on the provided template name
    switch (template) {
      case 'ec2_template':
        templatePath = path.join(TEMPLATES_DIR, 'ec2_template.json');
        break;
      case 'container_template':
        templatePath = path.join(TEMPLATES_DIR, 'container_template.json');
        break;
      case 'serverless_template':
        templatePath = path.join(TEMPLATES_DIR, 'serverless_template.json');
        break;
      default:
        return {
          success: false,
          error: `Unknown template: ${template}. Available templates: ec2_template, container_template, serverless_template`
        };
    }
    
    // Check if the template file exists
    if (!fs.existsSync(templatePath)) {
      return {
        success: false,
        error: `Template file not found: ${templatePath}`
      };
    }
    
    const options = {
      region,
      duration
    };
    
    const result = await analyzeTemplate(templatePath, options);
    
    return {
      success: !result.error,
      result: result.error ? { error: result.error } : result
    };
  }
});

// Register the architecture comparison action
server.tools.registerAction({
  name: 'compare_architectures',
  description: 'Compares costs between different AWS architecture templates',
  inputSchema: {
    type: 'object',
    properties: {
      architectures: {
        type: 'array',
        description: 'Array of architecture templates to compare (ec2_template, container_template, serverless_template)',
        items: {
          type: 'string'
        }
      },
      region: {
        type: 'string',
        description: 'AWS region to use for pricing (default: us-east-1)'
      },
      duration: {
        type: 'number',
        description: 'Duration in days for cost calculation (default: 30)'
      }
    },
    required: ['architectures']
  },
  handler: async ({ architectures, region, duration }) => {
    // Validate architectures
    if (!Array.isArray(architectures) || architectures.length < 2) {
      return {
        success: false,
        error: 'At least two architectures must be provided for comparison'
      };
    }
    
    const options = {
      region: region || 'us-east-1',
      duration: duration || 30,
      includeDetailedBreakdown: true
    };
    
    const results = [];
    const templatePaths = [];
    
    // Determine template paths and validate
    for (const template of architectures) {
      let templatePath;
      
      switch (template) {
        case 'ec2_template':
          templatePath = path.join(TEMPLATES_DIR, 'ec2_template.json');
          break;
        case 'container_template':
          templatePath = path.join(TEMPLATES_DIR, 'container_template.json');
          break;
        case 'serverless_template':
          templatePath = path.join(TEMPLATES_DIR, 'serverless_template.json');
          break;
        default:
          return {
            success: false,
            error: `Unknown template: ${template}. Available templates: ec2_template, container_template, serverless_template`
          };
      }
      
      // Check if the template file exists
      if (!fs.existsSync(templatePath)) {
        return {
          success: false,
          error: `Template file not found: ${templatePath}`
        };
      }
      
      templatePaths.push({ name: template, path: templatePath });
    }
    
    // Analyze each template
    for (const { name, path: templatePath } of templatePaths) {
      const result = await analyzeTemplate(templatePath, options);
      
      if (result.error) {
        return {
          success: false,
          error: `Error analyzing template ${name}: ${result.error}`
        };
      }
      
      results.push({
        name,
        analysis: result
      });
    }
    
    // Create comparison data
    const comparison = {
      architectures: results,
      options
    };
    
    return {
      success: true,
      comparison
    };
  }
});

// Start the server
server.listen(process.env.PORT || 0, () => {
  console.log(`AWS Cost Analysis MCP server is running on port ${server.address().port}`);
}); 
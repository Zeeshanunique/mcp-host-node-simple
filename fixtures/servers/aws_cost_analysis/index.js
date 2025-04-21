#!/usr/bin/env node

/**
 * AWS Cost Analysis MCP Server
 * 
 * This server provides functionality for analyzing and comparing
 * AWS CloudFormation/CDK stack templates for cost estimation.
 */

import { createServer } from '@modelcontextprotocol/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeCdkStack } from './cdk_analyzer.js';
import { generateRecommendations, generateComparisonRecommendations } from './optimizer.js';
import { generateHtmlReport } from './html_renderer.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define paths to template directories
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Create a new MCP server
const server = createServer({
  serverName: 'mcp_AWS_Cost_Analysis',
  defaultTimeout: 30000,
});

// Create templates directory if it doesn't exist
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

/**
 * Analyze a single CloudFormation/CDK template
 * 
 * @param {Object} params - Request parameters
 * @returns {Object} Analysis results
 */
async function analyze_template(params) {
  try {
    const { templatePath, name, region, options } = params;
    
    if (!templatePath) {
      return { error: "Template path is required" };
    }
    
    // Resolve the template path
    const resolvedPath = path.resolve(__dirname, templatePath);
    
    // Check if the file exists
    if (!fs.existsSync(resolvedPath)) {
      return { 
        error: "Template file not found",
        details: `Could not find file at path: ${resolvedPath}`
      };
    }
    
    // Parse the options
    const analysisOptions = {
      name: name || path.basename(resolvedPath, path.extname(resolvedPath)),
      region: region || 'us-east-1',
      includeSavingsPlans: options?.includeSavingsPlans || false,
      includeReservedInstances: options?.includeReservedInstances || false,
      assumedUtilization: options?.assumedUtilization || 0.7,
      additionalDetails: options?.additionalDetails || false
    };
    
    // Analyze the template
    const analysisResults = await analyzeCdkStack(resolvedPath, analysisOptions);
    
    // Generate optimization recommendations
    if (options?.includeRecommendations !== false) {
      analysisResults.recommendations = generateRecommendations(analysisResults);
    }
    
    // Format the results for display
    return {
      templateName: analysisResults.stackName || analysisOptions.name,
      region: analysisOptions.region,
      totalCost: analysisResults.totalCost,
      serviceCosts: analysisResults.serviceCosts,
      resources: analysisResults.resources,
      metrics: analysisResults.metrics,
      recommendations: analysisResults.recommendations || []
    };
  } catch (error) {
    console.error('Error analyzing template:', error);
    return {
      error: "Failed to analyze template",
      details: error.message,
      stack: error.stack
    };
  }
}

/**
 * Compare costs between different architecture templates
 * 
 * @param {Object} params - Request parameters
 * @returns {Object} Comparison results
 */
async function compare_architectures(params) {
  try {
    const { templates, generateHtml, options } = params;
    
    if (!templates || !Array.isArray(templates) || templates.length < 1) {
      return { error: "At least one template is required for comparison" };
    }
    
    // Analyze each template
    const architectures = [];
    for (const template of templates) {
      const analysis = await analyze_template({
        templatePath: template.path,
        name: template.name,
        region: template.region || options?.region,
        options: {
          ...options,
          includeRecommendations: false // We'll generate them collectively later
        }
      });
      
      if (analysis.error) {
        return {
          error: `Failed to analyze template: ${template.path}`,
          details: analysis.details || analysis.error
        };
      }
      
      architectures.push(analysis);
    }
    
    // Generate cross-architecture recommendations
    const recommendations = generateComparisonRecommendations(architectures);
    
    // Prepare comparison result
    const comparisonResult = {
      architectures,
      recommendations,
      timestamp: new Date().toISOString()
    };
    
    // Generate HTML report if requested
    let htmlReport = null;
    if (generateHtml) {
      htmlReport = generateHtmlReport(comparisonResult, {
        title: options?.reportTitle || 'AWS Architecture Cost Comparison'
      });
      
      // Save the HTML report if a path is provided
      if (options?.reportPath) {
        const reportPath = path.resolve(__dirname, options.reportPath);
        fs.writeFileSync(reportPath, htmlReport);
        comparisonResult.reportPath = reportPath;
      }
    }
    
    return {
      ...comparisonResult,
      htmlReport
    };
  } catch (error) {
    console.error('Error comparing architectures:', error);
    return {
      error: "Failed to compare architectures",
      details: error.message,
      stack: error.stack
    };
  }
}

/**
 * Save a template to the templates directory
 * 
 * @param {Object} params - Request parameters
 * @returns {Object} Result with saved path
 */
async function save_template(params) {
  try {
    const { content, filename, overwrite } = params;
    
    if (!content) {
      return { error: "Template content is required" };
    }
    
    if (!filename) {
      return { error: "Filename is required" };
    }
    
    // Ensure file has proper extension
    const sanitizedFilename = filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml') 
      ? filename 
      : `${filename}.json`;
    
    const targetPath = path.join(TEMPLATES_DIR, sanitizedFilename);
    
    // Check if file exists and should not be overwritten
    if (fs.existsSync(targetPath) && overwrite !== true) {
      return { 
        error: "File already exists", 
        details: "Set overwrite to true to replace existing file"
      };
    }
    
    // Save the template
    fs.writeFileSync(targetPath, content);
    
    return {
      success: true,
      path: `templates/${sanitizedFilename}`,
      fullPath: targetPath
    };
  } catch (error) {
    console.error('Error saving template:', error);
    return {
      error: "Failed to save template",
      details: error.message
    };
  }
}

/**
 * List available templates
 * 
 * @returns {Object} List of available templates
 */
async function list_templates() {
  try {
    const files = fs.readdirSync(TEMPLATES_DIR);
    
    const templates = files
      .filter(file => file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(file => ({
        name: file,
        path: `templates/${file}`,
        fullPath: path.join(TEMPLATES_DIR, file),
        size: fs.statSync(path.join(TEMPLATES_DIR, file)).size,
        lastModified: fs.statSync(path.join(TEMPLATES_DIR, file)).mtime
      }));
    
    return {
      templates,
      count: templates.length
    };
  } catch (error) {
    console.error('Error listing templates:', error);
    return {
      error: "Failed to list templates",
      details: error.message
    };
  }
}

// Create a placeholder optimizer module if it doesn't exist yet
if (!fs.existsSync(path.join(__dirname, 'optimizer.js'))) {
  const optimizerContent = `/**
 * Cost Optimization Recommendation Generator
 */

/**
 * Generate optimization recommendations for a single architecture
 * 
 * @param {Object} analysisResults - The analysis results
 * @returns {Array} List of recommendations
 */
function generateRecommendations(analysisResults) {
  const recommendations = [];
  
  // This is a placeholder implementation
  // In a real implementation, we would analyze the resources and generate
  // specific recommendations based on resource types, sizes, etc.
  
  return recommendations;
}

/**
 * Generate recommendations for multiple architectures
 * 
 * @param {Array} architectures - List of architecture analysis results
 * @returns {Array} List of recommendations
 */
function generateComparisonRecommendations(architectures) {
  const recommendations = [];
  
  // This is a placeholder implementation
  // In a real implementation, we would compare architectures and generate
  // recommendations for optimizing across them
  
  return recommendations;
}

module.exports = {
  generateRecommendations,
  generateComparisonRecommendations
};`;

  fs.writeFileSync(path.join(__dirname, 'optimizer.js'), optimizerContent);
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
    
    const result = await analyze_template({ templatePath, name: template, region, options });
    
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
      const result = await analyze_template({ templatePath, name, region, options });
      
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
/**
 * AWS Cost Analysis report generator
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readCostReportTemplate, formatCostData, populateTemplate } from './helpers.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate a cost report based on provided parameters
 * @param {Object} params Report parameters
 * @returns {Promise<Object>} Generation result with file path and status
 */
export const generateReport = async (params) => {
  try {
    // Get the report template
    const template = await readCostReportTemplate();
    
    if (!template) {
      return {
        status: "error",
        message: "Failed to load report template"
      };
    }
    
    // Format the cost data 
    const formattedCostData = formatCostData(params.detailed_cost_data);
    
    // Prepare the usage scaling table if provided
    let usageScalingTable = "No usage scaling data provided.";
    if (params.detailed_cost_data && params.detailed_cost_data.usage_scaling) {
      usageScalingTable = createUsageScalingTable(params.detailed_cost_data.usage_scaling);
    }
    
    // Prepare the projected costs table if provided
    let projectedCostsTable = "No projected costs data provided.";
    if (params.detailed_cost_data && params.detailed_cost_data.projected_costs) {
      projectedCostsTable = createProjectedCostsTable(params.detailed_cost_data.projected_costs);
    }
    
    // Format recommendations
    const formattedRecommendations = formatRecommendations(params.recommendations);
    
    // Prepare the template values
    const templateValues = {
      "service_name": params.service_name || "AWS Service",
      "pricing_model": params.pricing_model || "On-demand",
      "assumptions": formatAssumptions(params.assumptions),
      "limitations": formatLimitations(params.exclusions),
      "unit_pricing_details": formattedCostData.unitPricing,
      "cost_calculation_details": formattedCostData.costCalculation,
      "free_tier_info": formattedCostData.freeTier,
      "usage_scaling_table": usageScalingTable,
      "projected_costs_table": projectedCostsTable,
      "immediate_recommendations": formattedRecommendations.immediate,
      "best_practices": formattedRecommendations.bestPractices,
      "related_services": formatRelatedServices(params.related_services)
    };
    
    // Populate the template
    const reportContent = populateTemplate(template, templateValues);
    
    // Save the report to a file
    const outputPath = params.output_file || path.join(__dirname, `cost_report_${Date.now()}.md`);
    await fs.writeFile(outputPath, reportContent, 'utf8');
    
    return {
      status: "success",
      file_path: outputPath,
      message: "Cost report generated successfully"
    };
  } catch (error) {
    console.error(`Error generating report: ${error.message}`);
    return {
      status: "error",
      message: `Failed to generate report: ${error.message}`
    };
  }
};

/**
 * Format assumptions for the report
 * @param {Array} assumptions Array of assumption strings
 * @returns {string} Formatted assumptions text
 */
const formatAssumptions = (assumptions) => {
  if (!assumptions || !assumptions.length) {
    return "No specific assumptions were made for this analysis.";
  }
  
  return assumptions.map(assumption => `- ${assumption}`).join('\n');
};

/**
 * Format limitations for the report
 * @param {Array} limitations Array of limitation strings
 * @returns {string} Formatted limitations text
 */
const formatLimitations = (limitations) => {
  if (!limitations || !limitations.length) {
    return "No specific limitations apply to this analysis.";
  }
  
  return limitations.map(limitation => `- ${limitation}`).join('\n');
};

/**
 * Format recommendations for the report
 * @param {Object} recommendations Recommendation object
 * @returns {Object} Formatted recommendations
 */
const formatRecommendations = (recommendations) => {
  if (!recommendations) {
    return {
      immediate: "No immediate cost optimization recommendations available.",
      bestPractices: "No best practices recommendations available."
    };
  }
  
  const formatItems = items => {
    if (!items || !items.length) {
      return "None available.";
    }
    return items.map(item => `- ${item}`).join('\n');
  };
  
  return {
    immediate: formatItems(recommendations.immediate_recommendations),
    bestPractices: formatItems(recommendations.best_practices)
  };
};

/**
 * Format related services for the report
 * @param {Array} relatedServices Array of related service strings
 * @returns {string} Formatted related services text
 */
const formatRelatedServices = (relatedServices) => {
  if (!relatedServices || !relatedServices.length) {
    return "No related services were considered in this analysis.";
  }
  
  return relatedServices.map(service => `- ${service}`).join('\n');
};

/**
 * Create a table of usage scaling data
 * @param {Array} usageScalingData Array of usage scaling entries
 * @returns {string} Markdown table of usage scaling data
 */
const createUsageScalingTable = (usageScalingData) => {
  if (!usageScalingData || !usageScalingData.length) {
    return "No usage scaling data available.";
  }
  
  let table = "| Usage Level | Description | Estimated Monthly Cost |\n";
  table += "|-------------|-------------|-----------------------|\n";
  
  usageScalingData.forEach(entry => {
    table += `| ${entry.level || 'N/A'} | ${entry.description || 'N/A'} | ${entry.cost || 'N/A'} |\n`;
  });
  
  return table;
};

/**
 * Create a table of projected costs
 * @param {Array} projectedCostsData Array of projected cost entries
 * @returns {string} Markdown table of projected costs
 */
const createProjectedCostsTable = (projectedCostsData) => {
  if (!projectedCostsData || !projectedCostsData.length) {
    return "No projected costs data available.";
  }
  
  let table = "| Month | Projected Cost | Growth Pattern |\n";
  table += "|-------|----------------|----------------|\n";
  
  projectedCostsData.forEach(entry => {
    table += `| ${entry.month || 'N/A'} | ${entry.cost || 'N/A'} | ${entry.pattern || 'N/A'} |\n`;
  });
  
  return table;
}; 
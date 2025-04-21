/**
 * Helper functions for AWS Cost Analysis MCP Server.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads the Bedrock patterns file
 * @returns {Promise<string>} The contents of the Bedrock patterns file
 */
export const readBedrockPatterns = async () => {
  try {
    const filePath = path.join(__dirname, 'static', 'patterns', 'BEDROCK.md');
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading Bedrock patterns: ${error.message}`);
    return "Failed to load Bedrock patterns";
  }
};

/**
 * Reads the cost report template
 * @returns {Promise<string>} The contents of the cost report template
 */
export const readCostReportTemplate = async () => {
  try {
    const filePath = path.join(__dirname, 'static', 'COST_REPORT_TEMPLATE.md');
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading cost report template: ${error.message}`);
    return "Failed to load cost report template";
  }
};

/**
 * Format pricing data for report generation
 * @param {Object} pricingData Raw pricing data
 * @returns {Object} Formatted pricing data
 */
export const formatPricingData = (pricingData) => {
  if (!pricingData || !pricingData.data) {
    return {
      formatted: false,
      data: "No pricing data available"
    };
  }

  // Extract key pricing information
  const pricingText = pricingData.data;
  
  // Simple extraction of pricing information based on patterns
  const extractPricing = (text) => {
    const prices = [];
    // Look for patterns like "$X.XX per Y" or "$X.XXX per Z"
    const pricePattern = /\$(\d+\.\d+)\s+per\s+([^\n.,]+)/g;
    let match;
    
    while ((match = pricePattern.exec(text)) !== null) {
      prices.push({
        price: match[1],
        unit: match[2].trim()
      });
    }
    
    return prices;
  };
  
  const prices = extractPricing(pricingText);
  
  return {
    formatted: true,
    service: pricingData.service_name,
    prices: prices,
    rawData: pricingData.data
  };
};

/**
 * Generate an HTML table from an array of objects
 * @param {Array} data Array of objects
 * @param {Array} columns Column definitions
 * @returns {string} HTML table
 */
export const generateTable = (data, columns) => {
  if (!data || !data.length) {
    return "No data available";
  }

  let table = "|";
  
  // Add headers
  columns.forEach(col => {
    table += ` ${col.header} |`;
  });
  
  table += "\n|";
  
  // Add header separators
  columns.forEach(() => {
    table += " --- |";
  });
  
  table += "\n";
  
  // Add data rows
  data.forEach(row => {
    table += "|";
    columns.forEach(col => {
      const value = row[col.key] || "";
      table += ` ${value} |`;
    });
    table += "\n";
  });
  
  return table;
};

/**
 * Replace template placeholders with actual values
 * @param {string} template The template string
 * @param {Object} values Object containing values to replace placeholders
 * @returns {string} The populated template
 */
export const populateTemplate = (template, values) => {
  let result = template;
  
  // Replace simple placeholders
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
  });
  
  return result;
};

/**
 * Format cost data for report
 * @param {Object} costData Cost data object
 * @returns {Object} Formatted cost information
 */
export const formatCostData = (costData) => {
  if (!costData || !costData.services) {
    return {
      unitPricing: "No unit pricing details available",
      costCalculation: "No cost calculation details available",
      freeTier: "No free tier information available"
    };
  }
  
  let unitPricingDetails = [];
  let costCalculations = [];
  let freeTierInfo = [];
  
  // Process each service
  Object.entries(costData.services).forEach(([serviceName, details]) => {
    // Extract unit pricing
    if (details.unit_pricing) {
      Object.entries(details.unit_pricing).forEach(([category, price]) => {
        unitPricingDetails.push({
          service: serviceName,
          category: category,
          pricing: price
        });
      });
    }
    
    // Extract cost calculations
    if (details.calculation_details) {
      costCalculations.push({
        service: serviceName,
        details: details.calculation_details,
        totalCost: details.estimated_cost || "N/A"
      });
    }
    
    // Extract free tier info
    if (details.free_tier_info) {
      freeTierInfo.push({
        service: serviceName,
        freeOfferDetails: details.free_tier_info
      });
    }
  });
  
  // Generate tables
  const unitPricingTable = generateTable(unitPricingDetails, [
    { key: 'service', header: 'Service/Component' },
    { key: 'category', header: 'Category' },
    { key: 'pricing', header: 'Unit Price' }
  ]);
  
  const costCalculationTable = generateTable(costCalculations, [
    { key: 'service', header: 'Service/Component' },
    { key: 'details', header: 'Calculation' },
    { key: 'totalCost', header: 'Estimated Cost (Monthly)' }
  ]);
  
  // Format free tier information
  let freeTierText = "";
  if (freeTierInfo.length > 0) {
    freeTierInfo.forEach(item => {
      freeTierText += `- **${item.service}**: ${item.freeOfferDetails}\n`;
    });
  } else {
    freeTierText = "No free tier offers available for the selected services.";
  }
  
  return {
    unitPricing: unitPricingTable,
    costCalculation: costCalculationTable,
    freeTier: freeTierText
  };
}; 
/**
 * HTML Renderer for AWS Cost Analysis
 * 
 * This module generates HTML reports from the analysis results.
 */

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const moment = require('moment');

// Load the HTML template
const loadTemplate = () => {
  const templatePath = path.join(__dirname, 'templates', 'report-template.html');
  return fs.readFileSync(templatePath, 'utf8');
};

/**
 * Generate an HTML report from comparison results
 * 
 * @param {Object} comparisonResults - The results from comparing architecture costs
 * @param {Object} options - Additional options for report generation
 * @returns {String} - HTML content of the report
 */
const generateHtmlReport = (comparisonResults, options = {}) => {
  try {
    const template = loadTemplate();
    const compiledTemplate = Handlebars.compile(template);
    
    // Prepare data for the template
    const templateData = prepareTemplateData(comparisonResults, options);
    
    // Generate the HTML content
    return compiledTemplate(templateData);
  } catch (error) {
    console.error('Error generating HTML report:', error);
    return `<html><body><h1>Error Generating Report</h1><p>${error.message}</p></body></html>`;
  }
};

/**
 * Prepare data for the HTML template
 * 
 * @param {Object} comparisonResults - The comparison results
 * @param {Object} options - Additional options
 * @returns {Object} - Data for the template
 */
const prepareTemplateData = (comparisonResults, options) => {
  const architectures = comparisonResults.architectures || [];
  const architectureNames = architectures.map(a => a.name).join(' vs ');
  
  return {
    title: options.title || 'AWS Architecture Cost Analysis Report',
    date: moment().format('MMMM Do YYYY, h:mm:ss a'),
    architectureNames,
    totalCostComparison: generateTotalCostHtml(architectures),
    metricsComparison: generateMetricsComparisonHtml(architectures),
    serviceBreakdown: generateServiceBreakdownHtml(architectures),
    resourceDetails: generateResourceDetailsHtml(architectures),
    optimizationRecommendations: generateRecommendationsHtml(comparisonResults.recommendations),
    conclusion: generateConclusionHtml(architectures, comparisonResults.recommendations)
  };
};

/**
 * Generate HTML for total cost comparison
 */
const generateTotalCostHtml = (architectures) => {
  let html = '<div class="cost-summary">';
  
  // Find the architecture with the lowest cost
  const lowestCostArch = [...architectures].sort((a, b) => 
    (a.totalCost || 0) - (b.totalCost || 0))[0];
    
  architectures.forEach(arch => {
    const isBestValue = arch.name === lowestCostArch.name;
    
    html += `
      <div class="cost-card ${isBestValue ? 'best-value' : ''}">
        <h3>${arch.name}</h3>
        <div class="cost-value">$${formatNumber(arch.totalCost || 0)}</div>
        <div class="cost-label">Estimated Monthly Cost</div>
        ${isBestValue ? '<div class="badge badge-success">Best Value</div>' : ''}
      </div>
    `;
  });
  
  html += '</div>';
  return html;
};

/**
 * Generate HTML for metrics comparison
 */
const generateMetricsComparisonHtml = (architectures) => {
  let html = '<div class="comparison-container">';
  
  architectures.forEach(arch => {
    const metrics = arch.metrics || {};
    
    html += `
      <div class="comparison-item">
        <h3>${arch.name}</h3>
        <table>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>Total Resources</td>
            <td>${metrics.totalResources || 0}</td>
          </tr>
          <tr>
            <td>Compute Resources</td>
            <td>${metrics.computeResources || 0}</td>
          </tr>
          <tr>
            <td>Storage Resources</td>
            <td>${metrics.storageResources || 0}</td>
          </tr>
          <tr>
            <td>Network Resources</td>
            <td>${metrics.networkResources || 0}</td>
          </tr>
          <tr>
            <td>Management Resources</td>
            <td>${metrics.managementResources || 0}</td>
          </tr>
          <tr>
            <td>Cost Efficiency Score</td>
            <td>${formatNumber(metrics.costEfficiencyScore || 0)}/10</td>
          </tr>
        </table>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
};

/**
 * Generate HTML for service breakdown
 */
const generateServiceBreakdownHtml = (architectures) => {
  let html = '';
  
  architectures.forEach(arch => {
    const services = arch.serviceCosts || {};
    
    html += `
      <h3>${arch.name}</h3>
      <table>
        <tr>
          <th>Service</th>
          <th>Resources</th>
          <th>Monthly Cost</th>
          <th>Percentage</th>
        </tr>
    `;
    
    // Sort services by cost (descending)
    const sortedServices = Object.keys(services).sort((a, b) => 
      (services[b].cost || 0) - (services[a].cost || 0));
    
    sortedServices.forEach(serviceName => {
      const service = services[serviceName];
      const percentage = arch.totalCost ? ((service.cost / arch.totalCost) * 100) : 0;
      
      html += `
        <tr>
          <td>${serviceName}</td>
          <td>${service.resourceCount || 0}</td>
          <td>$${formatNumber(service.cost || 0)}</td>
          <td>${formatNumber(percentage)}%</td>
        </tr>
      `;
    });
    
    html += '</table>';
  });
  
  return html;
};

/**
 * Generate HTML for resource details
 */
const generateResourceDetailsHtml = (architectures) => {
  let html = '';
  
  architectures.forEach(arch => {
    html += `<h3>${arch.name} Resources</h3>`;
    
    const resources = arch.resources || [];
    if (resources.length === 0) {
      html += '<p>No detailed resource information available.</p>';
    } else {
      html += `
        <table>
          <tr>
            <th>Resource Type</th>
            <th>Identifier</th>
            <th>Configuration</th>
            <th>Monthly Cost</th>
          </tr>
      `;
      
      // Sort resources by cost (descending)
      const sortedResources = [...resources].sort((a, b) => 
        (b.estimatedCost || 0) - (a.estimatedCost || 0));
      
      sortedResources.forEach(resource => {
        const configDetails = formatResourceConfig(resource.configuration || {});
        
        html += `
          <tr>
            <td>${resource.type || 'Unknown'}</td>
            <td>${resource.id || 'N/A'}</td>
            <td>${configDetails}</td>
            <td>$${formatNumber(resource.estimatedCost || 0)}</td>
          </tr>
        `;
      });
      
      html += '</table>';
    }
  });
  
  return html;
};

/**
 * Generate HTML for optimization recommendations
 */
const generateRecommendationsHtml = (recommendations = []) => {
  if (!recommendations || recommendations.length === 0) {
    return '<p>No optimization recommendations available.</p>';
  }
  
  let html = '<div class="recommendations">';
  
  recommendations.forEach(recommendation => {
    const savingsClass = recommendation.potentialSavings > 100 ? 'color-success' : 
                         recommendation.potentialSavings > 10 ? 'color-warning' : '';
                         
    html += `
      <div class="recommendation-item">
        <div class="recommendation-title">${recommendation.title}</div>
        <p>${recommendation.description}</p>
        <p>Affected resources: ${recommendation.affectedResources || 'N/A'}</p>
        <p>Potential monthly savings: <span class="${savingsClass} recommendation-savings">$${formatNumber(recommendation.potentialSavings || 0)}</span></p>
        <p>Implementation difficulty: ${recommendation.implementationDifficulty || 'Medium'}</p>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
};

/**
 * Generate HTML for the conclusion section
 */
const generateConclusionHtml = (architectures, recommendations) => {
  // Find best architecture based on cost
  const bestArch = [...architectures].sort((a, b) => 
    (a.totalCost || 0) - (b.totalCost || 0))[0];
  
  // Calculate total potential savings
  const totalSavings = (recommendations || []).reduce(
    (sum, rec) => sum + (rec.potentialSavings || 0), 0
  );
  
  let html = `
    <p>Based on the analysis, <strong>${bestArch.name}</strong> appears to be the most cost-effective architecture 
    with an estimated monthly cost of <strong>$${formatNumber(bestArch.totalCost || 0)}</strong>.</p>
  `;
  
  if (totalSavings > 0) {
    html += `
      <p>By implementing the recommended optimizations, you could potentially save up to 
      <strong>$${formatNumber(totalSavings)}</strong> per month across all architectures.</p>
    `;
  }
  
  html += `
    <p>Remember that these estimates are based on static analysis of the CloudFormation templates 
    and may vary based on actual usage patterns, region-specific pricing, and potential AWS discounts.</p>
  `;
  
  return html;
};

/**
 * Format resource configuration as a readable string
 */
const formatResourceConfig = (config) => {
  if (!config || Object.keys(config).length === 0) {
    return 'No configuration details';
  }
  
  let configDetails = '';
  
  // Format common configuration properties
  if (config.instanceType) configDetails += `Instance Type: ${config.instanceType}<br>`;
  if (config.storageSize) configDetails += `Storage: ${config.storageSize} GB<br>`;
  if (config.memorySize) configDetails += `Memory: ${config.memorySize} MB<br>`;
  if (config.region) configDetails += `Region: ${config.region}<br>`;
  
  // Add other properties if the common ones aren't present
  if (configDetails === '') {
    const mainProps = Object.keys(config).slice(0, 3);
    mainProps.forEach(key => {
      const value = typeof config[key] === 'object' 
        ? JSON.stringify(config[key]).substring(0, 50) 
        : config[key];
      configDetails += `${key}: ${value}<br>`;
    });
    
    if (Object.keys(config).length > 3) {
      configDetails += '...';
    }
  }
  
  return configDetails;
};

/**
 * Format a number with commas and fixed decimal places
 */
const formatNumber = (number, decimals = 2) => {
  return number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

module.exports = {
  generateHtmlReport
}; 
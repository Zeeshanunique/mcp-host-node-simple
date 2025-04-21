/**
 * Tests for the HTML renderer module
 */

const fs = require('fs');
const path = require('path');
const { 
  loadTemplate, 
  generateHtmlReport, 
  prepareTemplateData 
} = require('../html_renderer');

// Mock the fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn()
}));

// Mock the Handlebars module
jest.mock('handlebars', () => ({
  compile: jest.fn().mockReturnValue((data) => JSON.stringify(data))
}));

describe('HTML Renderer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });
  
  const mockComparisonResult = {
    architecture1: {
      name: 'Serverless',
      totalEstimatedCost: 120.50,
      services: ['Lambda', 'API Gateway', 'S3', 'DynamoDB'],
      resourceCounts: {
        'AWS::Lambda::Function': 10,
        'AWS::ApiGateway::RestApi': 1,
        'AWS::S3::Bucket': 2,
        'AWS::DynamoDB::Table': 3
      },
      estimatedCostBreakdown: {
        Lambda: 50.20,
        'API Gateway': 25.10,
        S3: 10.30,
        DynamoDB: 34.90
      }
    },
    architecture2: {
      name: 'Container',
      totalEstimatedCost: 230.75,
      services: ['ECS', 'EC2', 'ELB', 'RDS'],
      resourceCounts: {
        'AWS::ECS::Cluster': 1,
        'AWS::EC2::Instance': 5,
        'AWS::ElasticLoadBalancing::LoadBalancer': 1,
        'AWS::RDS::DBInstance': 1
      },
      estimatedCostBreakdown: {
        ECS: 40.25,
        EC2: 110.50,
        ELB: 20.00,
        RDS: 60.00
      }
    },
    metrics: {
      costDifference: 110.25,
      percentageDifference: 91.5,
      moreExpensiveArchitecture: 'Container',
      lessExpensiveArchitecture: 'Serverless'
    },
    biggestCostFactors: [
      { service: 'EC2', cost: 110.50, architecture: 'Container' },
      { service: 'Lambda', cost: 50.20, architecture: 'Serverless' }
    ]
  };
  
  describe('loadTemplate', () => {
    it('should load template from file', () => {
      const templatePath = path.join(__dirname, '../static/templates/report.html');
      const mockTemplate = '<html>{{title}}</html>';
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTemplate);
      
      const result = loadTemplate(templatePath);
      
      expect(fs.readFileSync).toHaveBeenCalledWith(templatePath, 'utf8');
      expect(result).toBe(mockTemplate);
    });
    
    it('should throw error when template not found', () => {
      const templatePath = path.join(__dirname, '../static/templates/not_found.html');
      
      fs.existsSync.mockReturnValue(false);
      
      expect(() => loadTemplate(templatePath)).toThrow('Template file not found');
    });
  });
  
  describe('prepareTemplateData', () => {
    it('should prepare template data from comparison results', () => {
      const options = {
        title: 'AWS Architecture Cost Comparison',
        includeDate: true,
        showResourceDetails: true
      };
      
      const result = prepareTemplateData(mockComparisonResult, options);
      
      expect(result).toHaveProperty('title', 'AWS Architecture Cost Comparison');
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('architecture1Name', 'Serverless');
      expect(result).toHaveProperty('architecture2Name', 'Container');
      expect(result).toHaveProperty('totalCostComparison');
      expect(result).toHaveProperty('metricsComparison');
      expect(result).toHaveProperty('serviceBreakdown');
      expect(result).toHaveProperty('resourceDetails');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('conclusion');
      
      expect(result.metricsComparison).toContain('91.5%');
      expect(result.metricsComparison).toContain('$110.25');
      
      // Check service breakdowns
      expect(result.serviceBreakdown.architecture1).toHaveLength(4); // 4 services
      expect(result.serviceBreakdown.architecture2).toHaveLength(4); // 4 services
      
      // Check resource details are included
      expect(result.resourceDetails.architecture1).toBeDefined();
      expect(result.resourceDetails.architecture2).toBeDefined();
    });
    
    it('should handle minimal options', () => {
      const options = {
        title: 'Minimal Report'
      };
      
      const result = prepareTemplateData(mockComparisonResult, options);
      
      expect(result).toHaveProperty('title', 'Minimal Report');
      expect(result).not.toHaveProperty('date');
      
      // Should still have essential sections
      expect(result).toHaveProperty('architecture1Name');
      expect(result).toHaveProperty('architecture2Name');
      expect(result).toHaveProperty('totalCostComparison');
      expect(result).toHaveProperty('metricsComparison');
    });
    
    it('should work with excluded resource details', () => {
      const options = {
        showResourceDetails: false
      };
      
      const result = prepareTemplateData(mockComparisonResult, options);
      
      // Resource details should be empty/not included
      expect(result.resourceDetails).toEqual({});
    });
  });
  
  describe('generateHtmlReport', () => {
    it('should generate HTML report using template and data', () => {
      const templatePath = path.join(__dirname, '../static/templates/report.html');
      const mockTemplate = '<html>{{title}}</html>';
      const options = {
        title: 'Generated Report',
        templatePath: templatePath
      };
      
      // Mock template loading
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTemplate);
      
      const result = generateHtmlReport(mockComparisonResult, options);
      
      // Since we mocked Handlebars to return JSON.stringify of the data
      const renderedData = JSON.parse(result);
      
      expect(renderedData).toHaveProperty('title', 'Generated Report');
      expect(renderedData).toHaveProperty('architecture1Name', 'Serverless');
      expect(renderedData).toHaveProperty('architecture2Name', 'Container');
    });
    
    it('should use default template path if not provided', () => {
      const defaultTemplatePath = path.join(__dirname, '../static/templates/report_template.html');
      const mockTemplate = '<html>{{title}}</html>';
      const options = {
        title: 'Default Template Report'
      };
      
      // Mock template loading
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockTemplate);
      
      generateHtmlReport(mockComparisonResult, options);
      
      // Check if it tried to load the default template
      expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('report_template.html'), 'utf8');
    });
    
    it('should handle errors during report generation', () => {
      const options = {
        title: 'Error Report'
      };
      
      // Force an error during template loading
      fs.existsSync.mockReturnValue(false);
      
      expect(() => generateHtmlReport(mockComparisonResult, options)).toThrow();
    });
  });
}); 
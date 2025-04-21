/**
 * Tests for the architecture comparison module
 */

const {
  compareArchitectures,
  calculateMetrics,
  findBiggestCostFactors
} = require('../architecture_comparison');

describe('Architecture Comparison', () => {
  // Sample architecture data for tests
  const serverlessArch = {
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
  };
  
  const containerArch = {
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
  };
  
  describe('calculateMetrics', () => {
    it('should calculate cost difference metrics between architectures', () => {
      const result = calculateMetrics(serverlessArch, containerArch);
      
      expect(result).toHaveProperty('costDifference');
      expect(result).toHaveProperty('percentageDifference');
      expect(result).toHaveProperty('moreExpensiveArchitecture');
      expect(result).toHaveProperty('lessExpensiveArchitecture');
      
      expect(result.costDifference).toBeCloseTo(110.25, 2);
      expect(result.percentageDifference).toBeCloseTo(91.5, 1);
      expect(result.moreExpensiveArchitecture).toBe('Container');
      expect(result.lessExpensiveArchitecture).toBe('Serverless');
    });
    
    it('should handle case where architectures have the same cost', () => {
      const archA = { ...serverlessArch, totalEstimatedCost: 100 };
      const archB = { ...containerArch, totalEstimatedCost: 100 };
      
      const result = calculateMetrics(archA, archB);
      
      expect(result.costDifference).toBe(0);
      expect(result.percentageDifference).toBe(0);
      expect(result.moreExpensiveArchitecture).toBe(null);
      expect(result.lessExpensiveArchitecture).toBe(null);
    });
    
    it('should handle second architecture being cheaper', () => {
      const archA = { ...serverlessArch, totalEstimatedCost: 250 };
      const archB = { ...containerArch, totalEstimatedCost: 150 };
      
      const result = calculateMetrics(archA, archB);
      
      expect(result.costDifference).toBe(100);
      expect(result.percentageDifference).toBe(66.67); // 100/150 * 100
      expect(result.moreExpensiveArchitecture).toBe('Serverless');
      expect(result.lessExpensiveArchitecture).toBe('Container');
    });
  });
  
  describe('findBiggestCostFactors', () => {
    it('should identify the biggest cost factors across architectures', () => {
      const factors = findBiggestCostFactors(serverlessArch, containerArch);
      
      expect(Array.isArray(factors)).toBe(true);
      expect(factors.length).toBeGreaterThan(0);
      
      // First factor should be the most expensive
      expect(factors[0].service).toBe('EC2');
      expect(factors[0].cost).toBe(110.50);
      expect(factors[0].architecture).toBe('Container');
      
      // Second factor should be the second most expensive
      expect(factors[1].service).toBe('RDS');
      expect(factors[1].cost).toBe(60.00);
      expect(factors[1].architecture).toBe('Container');
    });
    
    it('should limit the number of factors returned', () => {
      const factors = findBiggestCostFactors(serverlessArch, containerArch, 3);
      
      expect(factors.length).toBe(3);
    });
    
    it('should handle empty cost breakdowns', () => {
      const archA = { ...serverlessArch, estimatedCostBreakdown: {} };
      const archB = { ...containerArch, estimatedCostBreakdown: {} };
      
      const factors = findBiggestCostFactors(archA, archB);
      
      expect(factors).toEqual([]);
    });
  });
  
  describe('compareArchitectures', () => {
    it('should compare two architectures and return a comprehensive result', () => {
      const result = compareArchitectures(serverlessArch, containerArch);
      
      expect(result).toHaveProperty('architecture1');
      expect(result).toHaveProperty('architecture2');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('biggestCostFactors');
      
      expect(result.architecture1).toEqual(serverlessArch);
      expect(result.architecture2).toEqual(containerArch);
      expect(result.metrics.costDifference).toBeCloseTo(110.25, 2);
      expect(result.biggestCostFactors.length).toBeGreaterThan(0);
    });
    
    it('should handle custom names for architectures', () => {
      const options = {
        architecture1Name: 'CustomServerless',
        architecture2Name: 'CustomContainer'
      };
      
      const result = compareArchitectures(serverlessArch, containerArch, options);
      
      expect(result.architecture1.name).toBe('CustomServerless');
      expect(result.architecture2.name).toBe('CustomContainer');
    });
    
    it('should use the limit option for biggest cost factors', () => {
      const options = {
        costFactorsLimit: 2
      };
      
      const result = compareArchitectures(serverlessArch, containerArch, options);
      
      expect(result.biggestCostFactors.length).toBe(2);
    });
    
    it('should handle architecture objects without names', () => {
      const archA = { ...serverlessArch };
      const archB = { ...containerArch };
      delete archA.name;
      delete archB.name;
      
      const result = compareArchitectures(archA, archB);
      
      expect(result.architecture1.name).toBe('Architecture 1');
      expect(result.architecture2.name).toBe('Architecture 2');
    });
  });
}); 
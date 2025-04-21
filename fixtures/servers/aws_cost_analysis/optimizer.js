/**
 * Cost Optimization Recommendation Generator
 * 
 * This module analyzes AWS architecture resources and generates
 * cost optimization recommendations based on best practices.
 */

/**
 * Generate optimization recommendations for a single architecture
 * 
 * @param {Object} analysisResults - The analysis results
 * @returns {Array} List of recommendations
 */
function generateRecommendations(analysisResults) {
  const recommendations = [];
  
  if (!analysisResults || !analysisResults.resources) {
    return recommendations;
  }
  
  // Analyze EC2 instances
  analyzeEC2Instances(analysisResults, recommendations);
  
  // Analyze Lambda functions
  analyzeLambdaFunctions(analysisResults, recommendations);
  
  // Analyze S3 buckets
  analyzeS3Buckets(analysisResults, recommendations);
  
  // Analyze DynamoDB tables
  analyzeDynamoDBTables(analysisResults, recommendations);
  
  // Analyze RDS instances
  analyzeRDSInstances(analysisResults, recommendations);
  
  // Analyze general architecture patterns
  analyzeArchitecturePatterns(analysisResults, recommendations);
  
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
  
  if (!architectures || !Array.isArray(architectures) || architectures.length < 2) {
    return recommendations;
  }

  // Compare total costs
  compareTotalCosts(architectures, recommendations);
  
  // Compare service distribution
  compareServiceDistribution(architectures, recommendations);
  
  // Compare resource efficiency
  compareResourceEfficiency(architectures, recommendations);
  
  // Analyze architectural differences
  analyzeArchitecturalDifferences(architectures, recommendations);
  
  return recommendations;
}

/**
 * Analyze EC2 instances for cost optimization opportunities
 * 
 * @param {Object} analysisResults - The analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeEC2Instances(analysisResults, recommendations) {
  const resources = analysisResults.resources || [];
  const ec2Instances = resources.filter(r => r.type === 'AWS::EC2::Instance');
  
  if (ec2Instances.length === 0) {
    return;
  }
  
  // Check for underutilized instances
  const metrics = analysisResults.metrics || {};
  const cpuUtilization = metrics.averageCpuUtilization || 0;
  
  if (cpuUtilization < 40 && ec2Instances.length > 0) {
    recommendations.push({
      title: "Consider rightsizing EC2 instances",
      description: "Some EC2 instances appear to be underutilized based on CPU metrics. Consider using smaller instance types or implementing Auto Scaling.",
      impact: "High",
      resourceType: "EC2",
      estimatedSavings: calculateRightsizingSavings(ec2Instances),
      action: "Review EC2 instance sizes and utilization patterns"
    });
  }
  
  // Check for reserved instance opportunities
  if (ec2Instances.length >= 2) {
    recommendations.push({
      title: "Consider Reserved Instances for stable workloads",
      description: "You have multiple EC2 instances that could benefit from Reserved Instance pricing for consistent workloads.",
      impact: "Medium",
      resourceType: "EC2",
      estimatedSavings: calculateReservedInstanceSavings(ec2Instances),
      action: "Evaluate 1 or 3-year Reserved Instance commitments"
    });
  }
}

/**
 * Analyze Lambda functions for cost optimization opportunities
 * 
 * @param {Object} analysisResults - The analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeLambdaFunctions(analysisResults, recommendations) {
  const resources = analysisResults.resources || [];
  const lambdaFunctions = resources.filter(r => r.type === 'AWS::Lambda::Function');
  
  if (lambdaFunctions.length === 0) {
    return;
  }
  
  // Check for memory optimization
  const highMemoryLambdas = lambdaFunctions.filter(lambda => {
    const memory = lambda.properties?.MemorySize || 128;
    return memory > 1024;
  });
  
  if (highMemoryLambdas.length > 0) {
    recommendations.push({
      title: "Optimize Lambda function memory allocation",
      description: `${highMemoryLambdas.length} Lambda functions have high memory settings. Consider tuning memory based on actual usage.`,
      impact: "Medium",
      resourceType: "Lambda",
      estimatedSavings: calculateLambdaMemoryOptimizationSavings(highMemoryLambdas),
      action: "Review CloudWatch metrics for each function and adjust memory settings"
    });
  }
  
  // Check for timeout settings
  const highTimeoutLambdas = lambdaFunctions.filter(lambda => {
    const timeout = lambda.properties?.Timeout || 3;
    return timeout > 30;
  });
  
  if (highTimeoutLambdas.length > 0) {
    recommendations.push({
      title: "Review Lambda function timeout settings",
      description: "Some Lambda functions have high timeout settings which may indicate inefficient processing.",
      impact: "Low",
      resourceType: "Lambda",
      action: "Profile Lambda execution times and optimize code"
    });
  }
}

/**
 * Analyze S3 buckets for cost optimization opportunities
 * 
 * @param {Object} analysisResults - The analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeS3Buckets(analysisResults, recommendations) {
  const resources = analysisResults.resources || [];
  const s3Buckets = resources.filter(r => r.type === 'AWS::S3::Bucket');
  
  if (s3Buckets.length === 0) {
    return;
  }
  
  // Check for lifecycle policies
  const bucketsWithoutLifecycle = s3Buckets.filter(bucket => 
    !bucket.properties?.LifecycleConfiguration);
  
  if (bucketsWithoutLifecycle.length > 0) {
    recommendations.push({
      title: "Implement S3 lifecycle policies",
      description: `${bucketsWithoutLifecycle.length} S3 buckets do not have lifecycle policies configured. Consider adding policies to transition infrequently accessed objects to cheaper storage classes.`,
      impact: "Medium",
      resourceType: "S3",
      estimatedSavings: calculateS3LifecycleSavings(s3Buckets),
      action: "Configure lifecycle policies to move data to Infrequent Access or Glacier storage classes"
    });
  }
}

/**
 * Analyze DynamoDB tables for cost optimization opportunities
 * 
 * @param {Object} analysisResults - The analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeDynamoDBTables(analysisResults, recommendations) {
  const resources = analysisResults.resources || [];
  const dynamodbTables = resources.filter(r => r.type === 'AWS::DynamoDB::Table');
  
  if (dynamodbTables.length === 0) {
    return;
  }
  
  // Check for provisioned capacity mode
  const provisionedTables = dynamodbTables.filter(table => 
    table.properties?.BillingMode === 'PROVISIONED' || !table.properties?.BillingMode);
  
  if (provisionedTables.length > 0) {
    recommendations.push({
      title: "Consider DynamoDB On-Demand capacity mode",
      description: "For unpredictable workloads, DynamoDB On-Demand capacity mode can be more cost-effective than Provisioned capacity.",
      impact: "Medium",
      resourceType: "DynamoDB",
      action: "Evaluate usage patterns and consider switching tables to On-Demand mode"
    });
  }
}

/**
 * Analyze RDS instances for cost optimization opportunities
 * 
 * @param {Object} analysisResults - The analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeRDSInstances(analysisResults, recommendations) {
  const resources = analysisResults.resources || [];
  const rdsInstances = resources.filter(r => r.type === 'AWS::RDS::DBInstance');
  
  if (rdsInstances.length === 0) {
    return;
  }
  
  // Check for Multi-AZ deployments
  const multiAZInstances = rdsInstances.filter(rds => 
    rds.properties?.MultiAZ === true);
  
  if (multiAZInstances.length > 0 && analysisResults.totalCost < 200) {
    recommendations.push({
      title: "Evaluate necessity of Multi-AZ RDS deployments",
      description: "For non-production environments, consider using Single-AZ RDS deployments to reduce costs.",
      impact: "Medium",
      resourceType: "RDS",
      estimatedSavings: calculateMultiAZSavings(multiAZInstances),
      action: "Evaluate high availability requirements and consider Single-AZ for non-critical environments"
    });
  }
}

/**
 * Analyze general architecture patterns for optimization
 * 
 * @param {Object} analysisResults - The analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeArchitecturePatterns(analysisResults, recommendations) {
  const resources = analysisResults.resources || [];
  
  // Check for serverless opportunities
  const ec2Count = resources.filter(r => r.type === 'AWS::EC2::Instance').length;
  const ecsCount = resources.filter(r => r.type.startsWith('AWS::ECS::')).length;
  const lambdaCount = resources.filter(r => r.type === 'AWS::Lambda::Function').length;
  
  if (ec2Count > 0 && lambdaCount === 0) {
    recommendations.push({
      title: "Consider serverless architecture components",
      description: "Your architecture relies heavily on EC2 instances. Consider evaluating serverless options like Lambda for suitable workloads.",
      impact: "High",
      resourceType: "Architecture",
      action: "Identify suitable workloads for serverless migration"
    });
  }
  
  // Check for caching opportunities
  const apiGatewayCount = resources.filter(r => r.type.startsWith('AWS::ApiGateway::')).length;
  const cloudfrontCount = resources.filter(r => r.type === 'AWS::CloudFront::Distribution').length;
  const elasticacheCount = resources.filter(r => r.type.startsWith('AWS::ElastiCache::')).length;
  
  if (apiGatewayCount > 0 && cloudfrontCount === 0 && elasticacheCount === 0) {
    recommendations.push({
      title: "Implement caching solutions",
      description: "Consider adding CloudFront or ElastiCache to reduce direct API calls and improve performance/cost efficiency.",
      impact: "Medium",
      resourceType: "Architecture",
      action: "Evaluate CloudFront for API caching or ElastiCache for application-level caching"
    });
  }
}

/**
 * Compare total costs between architectures
 * 
 * @param {Array} architectures - List of architecture analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function compareTotalCosts(architectures, recommendations) {
  // Sort architectures by total cost
  const sortedArchitectures = [...architectures].sort((a, b) => 
    a.totalCost - b.totalCost);
  
  const cheapest = sortedArchitectures[0];
  const mostExpensive = sortedArchitectures[sortedArchitectures.length - 1];
  const costDifference = mostExpensive.totalCost - cheapest.totalCost;
  
  if (costDifference > 100) {
    const savingsPercentage = ((costDifference / mostExpensive.totalCost) * 100).toFixed(1);
    
    recommendations.push({
      title: `${cheapest.templateName} is more cost-effective`,
      description: `The ${cheapest.templateName} architecture is ${savingsPercentage}% cheaper than ${mostExpensive.templateName}. Consider adopting similar patterns where applicable.`,
      impact: "High",
      resourceType: "Architecture",
      estimatedSavings: costDifference,
      action: "Review key architectural differences and cost drivers"
    });
  }
}

/**
 * Compare service distribution between architectures
 * 
 * @param {Array} architectures - List of architecture analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function compareServiceDistribution(architectures, recommendations) {
  // Look for architectures with significantly different service distributions
  for (let i = 0; i < architectures.length; i++) {
    const arch1 = architectures[i];
    
    for (let j = i + 1; j < architectures.length; j++) {
      const arch2 = architectures[j];
      
      // Compare service costs
      const arch1Services = arch1.serviceCosts || {};
      const arch2Services = arch2.serviceCosts || {};
      
      // Find services that are much cheaper in one architecture
      Object.keys(arch1Services).forEach(service => {
        if (arch2Services[service] && arch1Services[service] > 0) {
          const costRatio = arch2Services[service] / arch1Services[service];
          
          if (costRatio < 0.5 && (arch1Services[service] - arch2Services[service]) > 20) {
            recommendations.push({
              title: `${service} usage is more efficient in ${arch2.templateName}`,
              description: `${service} costs are significantly lower in the ${arch2.templateName} architecture. Consider examining its implementation approach.`,
              impact: "Medium",
              resourceType: service,
              action: `Review ${service} configuration in both architectures`
            });
          }
        }
      });
    }
  }
}

/**
 * Compare resource efficiency between architectures
 * 
 * @param {Array} architectures - List of architecture analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function compareResourceEfficiency(architectures, recommendations) {
  // Calculate cost per resource for each architecture
  const efficiencyMetrics = architectures.map(arch => {
    const resourceCount = (arch.resources || []).length;
    return {
      name: arch.templateName,
      costPerResource: resourceCount > 0 ? arch.totalCost / resourceCount : 0
    };
  });
  
  // Sort by efficiency
  efficiencyMetrics.sort((a, b) => a.costPerResource - b.costPerResource);
  
  // If there's a significant difference in efficiency
  if (efficiencyMetrics.length >= 2) {
    const mostEfficient = efficiencyMetrics[0];
    const leastEfficient = efficiencyMetrics[efficiencyMetrics.length - 1];
    
    if (leastEfficient.costPerResource > mostEfficient.costPerResource * 1.5) {
      recommendations.push({
        title: `${mostEfficient.name} has better resource efficiency`,
        description: `The ${mostEfficient.name} architecture has better cost-to-resource ratio than ${leastEfficient.name}. This may indicate more efficient resource utilization.`,
        impact: "Medium",
        resourceType: "Architecture",
        action: "Review resource utilization patterns across architectures"
      });
    }
  }
}

/**
 * Analyze architectural differences between solutions
 * 
 * @param {Array} architectures - List of architecture analysis results
 * @param {Array} recommendations - The recommendations array to append to
 */
function analyzeArchitecturalDifferences(architectures, recommendations) {
  // Check for architectural pattern differences
  const hasServerless = architectures.some(arch => 
    arch.templateName.toLowerCase().includes('serverless') ||
    (arch.resources || []).some(r => r.type === 'AWS::Lambda::Function')
  );
  
  const hasContainers = architectures.some(arch => 
    arch.templateName.toLowerCase().includes('container') ||
    (arch.resources || []).some(r => r.type.startsWith('AWS::ECS::') || r.type.startsWith('AWS::EKS::'))
  );
  
  const hasEC2 = architectures.some(arch => 
    arch.templateName.toLowerCase().includes('ec2') ||
    (arch.resources || []).some(r => r.type === 'AWS::EC2::Instance')
  );
  
  // If we have multiple paradigms, make recommendations
  if ([hasServerless, hasContainers, hasEC2].filter(Boolean).length > 1) {
    let lowestCostArchitecture = architectures.reduce((prev, current) => 
      (prev.totalCost < current.totalCost) ? prev : current
    );
    
    let architectureType = "";
    if (lowestCostArchitecture.templateName.toLowerCase().includes('serverless') ||
        (lowestCostArchitecture.resources || []).some(r => r.type === 'AWS::Lambda::Function')) {
      architectureType = "serverless";
    } else if (lowestCostArchitecture.templateName.toLowerCase().includes('container') ||
              (lowestCostArchitecture.resources || []).some(r => r.type.startsWith('AWS::ECS::') || r.type.startsWith('AWS::EKS::'))) {
      architectureType = "container-based";
    } else {
      architectureType = "EC2-based";
    }
    
    recommendations.push({
      title: `Consider hybrid or complete ${architectureType} architecture`,
      description: `The ${architectureType} architecture (${lowestCostArchitecture.templateName}) has the lowest overall cost. Consider evaluating which workloads would benefit from this approach.`,
      impact: "High",
      resourceType: "Architecture",
      action: `Evaluate workloads for potential migration to a ${architectureType} approach`
    });
  }
}

/**
 * Calculate estimated savings from EC2 rightsizing
 * 
 * @param {Array} ec2Instances - List of EC2 instance resources
 * @returns {number} Estimated monthly savings
 */
function calculateRightsizingSavings(ec2Instances) {
  // Simple estimation: assume 30% savings from rightsizing
  let totalEC2Cost = 0;
  
  ec2Instances.forEach(instance => {
    totalEC2Cost += instance.estimatedCost || 0;
  });
  
  return totalEC2Cost * 0.3;
}

/**
 * Calculate estimated savings from Reserved Instances
 * 
 * @param {Array} ec2Instances - List of EC2 instance resources
 * @returns {number} Estimated monthly savings
 */
function calculateReservedInstanceSavings(ec2Instances) {
  // Simple estimation: assume 40% savings from Reserved Instances
  let totalEC2Cost = 0;
  
  ec2Instances.forEach(instance => {
    totalEC2Cost += instance.estimatedCost || 0;
  });
  
  return totalEC2Cost * 0.4;
}

/**
 * Calculate estimated savings from Lambda memory optimization
 * 
 * @param {Array} lambdaFunctions - List of Lambda function resources
 * @returns {number} Estimated monthly savings
 */
function calculateLambdaMemoryOptimizationSavings(lambdaFunctions) {
  // Simple estimation: assume 20% savings from memory optimization
  let totalLambdaCost = 0;
  
  lambdaFunctions.forEach(lambda => {
    totalLambdaCost += lambda.estimatedCost || 0;
  });
  
  return totalLambdaCost * 0.2;
}

/**
 * Calculate estimated savings from S3 lifecycle policies
 * 
 * @param {Array} s3Buckets - List of S3 bucket resources
 * @returns {number} Estimated monthly savings
 */
function calculateS3LifecycleSavings(s3Buckets) {
  // Simple estimation: assume 30% savings from lifecycle policies
  let totalS3Cost = 0;
  
  s3Buckets.forEach(bucket => {
    totalS3Cost += bucket.estimatedCost || 0;
  });
  
  return totalS3Cost * 0.3;
}

/**
 * Calculate estimated savings from switching Multi-AZ RDS to Single-AZ
 * 
 * @param {Array} rdsInstances - List of RDS instance resources
 * @returns {number} Estimated monthly savings
 */
function calculateMultiAZSavings(rdsInstances) {
  // Multi-AZ typically costs about 2x Single-AZ, so savings would be ~50%
  let totalRDSCost = 0;
  
  rdsInstances.forEach(rds => {
    totalRDSCost += rds.estimatedCost || 0;
  });
  
  return totalRDSCost * 0.5;
}

export {
  generateRecommendations,
  generateComparisonRecommendations
}; 
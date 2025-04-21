/**
 * AWS Cost Analysis Price Calculator
 * 
 * Contains pricing models and calculation functions for AWS services
 */

import { formatCurrency, formatPercentage } from './helpers.js';

/**
 * Default pricing constants for common AWS services
 */
export const AWS_PRICING = {
  LAMBDA: {
    REQUEST_PRICE: 0.20 / 1000000, // $0.20 per 1M requests
    DURATION_PRICE: 0.0000166667, // per GB-second
    FREE_TIER: {
      REQUESTS: 1000000, // 1M requests per month
      COMPUTE_TIME: 400000 // 400K GB-seconds per month
    }
  },
  S3: {
    STORAGE_PRICE: {
      STANDARD: 0.023, // per GB for first 50TB
      STANDARD_IA: 0.0125, // per GB
      ONE_ZONE_IA: 0.01, // per GB
      GLACIER: 0.004 // per GB
    },
    REQUEST_PRICE: {
      PUT: 0.005 / 1000, // per 1000 PUT/POST/LIST requests
      GET: 0.0004 / 1000, // per 1000 GET requests
      DELETE: 0.0 // free
    },
    FREE_TIER: {
      STORAGE: 5, // 5GB standard storage
      PUT_REQUESTS: 20000, // 20K PUT requests
      GET_REQUESTS: 2000 // 2K GET requests
    }
  },
  DYNAMODB: {
    PROVISIONED: {
      RCU: 0.00013 * 730, // per RCU-hour
      WCU: 0.00065 * 730 // per WCU-hour
    },
    ON_DEMAND: {
      RCU: 0.25 / 1000000, // per million RRUs
      WCU: 1.25 / 1000000 // per million WRUs
    },
    STORAGE: 0.25, // per GB
    FREE_TIER: {
      RCU: 25, // 25 RCUs
      WCU: 25, // 25 WCUs
      STORAGE: 25 // 25GB storage
    }
  },
  API_GATEWAY: {
    REQUEST_PRICE: 3.50 / 1000000, // $3.50 per million requests
    DATA_TRANSFER: 0.09, // per GB out
    FREE_TIER: {
      REQUESTS: 1000000 // 1M requests per month
    }
  },
  EC2: {
    PRICING_BY_TYPE: {
      't3.micro': 0.0104 * 730, // per hour * hours in month
      't3.small': 0.0208 * 730,
      't3.medium': 0.0416 * 730,
      'm5.large': 0.096 * 730,
      'c5.large': 0.085 * 730
    },
    EBS: {
      GP2: 0.10, // per GB-month
      IO1: 0.125 // per GB-month
    },
    FREE_TIER: {
      HOURS: 750, // 750 hours of t2.micro/t3.micro
      EBS: 30 // 30GB EBS storage
    }
  }
};

/**
 * Calculate Lambda function costs
 * @param {Object} usage - Lambda usage details
 * @returns {Object} - Cost breakdown
 */
export const calculateLambdaCost = (usage) => {
  const { 
    avg_monthly_requests = 1000000, 
    avg_memory_size = 128, 
    avg_duration_ms = 500,
    avg_resource_count = 1
  } = usage;
  
  // Calculate total requests
  const totalRequests = avg_monthly_requests * avg_resource_count;
  
  // Calculate GB-seconds
  // Memory in MB / 1024 to get GB * duration in ms / 1000 to get seconds
  const gbSeconds = (totalRequests * avg_memory_size * (avg_duration_ms / 1000)) / 1024;
  
  // Calculate request cost
  const requestCost = totalRequests * AWS_PRICING.LAMBDA.REQUEST_PRICE;
  
  // Calculate compute cost
  const computeCost = gbSeconds * AWS_PRICING.LAMBDA.DURATION_PRICE;
  
  // Calculate total cost
  const totalCost = requestCost + computeCost;
  
  // Apply free tier if eligible
  let freeTierSavings = 0;
  if (usage.apply_free_tier) {
    // Calculate free tier savings for requests
    const freeTierRequestSavings = Math.min(
      AWS_PRICING.LAMBDA.FREE_TIER.REQUESTS * AWS_PRICING.LAMBDA.REQUEST_PRICE,
      requestCost
    );
    
    // Calculate free tier savings for compute
    const freeTierComputeSavings = Math.min(
      AWS_PRICING.LAMBDA.FREE_TIER.COMPUTE_TIME * AWS_PRICING.LAMBDA.DURATION_PRICE,
      computeCost
    );
    
    freeTierSavings = freeTierRequestSavings + freeTierComputeSavings;
  }
  
  // Calculate final cost
  const finalCost = Math.max(0, totalCost - freeTierSavings);
  
  return {
    service: 'Lambda',
    monthly_cost: finalCost,
    annual_cost: finalCost * 12,
    free_tier_eligible: true,
    free_tier_limit: `${AWS_PRICING.LAMBDA.FREE_TIER.REQUESTS.toLocaleString()} requests + ${(AWS_PRICING.LAMBDA.FREE_TIER.COMPUTE_TIME).toLocaleString()} GB-seconds per month`,
    breakdown: [
      { 
        component: 'Requests', 
        quantity: `${totalRequests.toLocaleString()} requests`,
        cost: requestCost
      },
      { 
        component: 'Compute', 
        quantity: `${gbSeconds.toFixed(2)} GB-seconds (${avg_memory_size}MB × ${avg_duration_ms}ms × ${totalRequests.toLocaleString()} invocations)`,
        cost: computeCost
      },
      {
        component: 'Free Tier Savings',
        quantity: usage.apply_free_tier ? 'Applied' : 'Not Applied',
        cost: -freeTierSavings
      }
    ]
  };
};

/**
 * Calculate S3 storage costs
 * @param {Object} usage - S3 usage details
 * @returns {Object} - Cost breakdown
 */
export const calculateS3Cost = (usage) => {
  const {
    storage_gb = 20,
    monthly_get_requests = 100000,
    monthly_put_requests = 20000,
    bucket_count = 1,
    apply_free_tier = true
  } = usage;
  
  // Calculate storage cost
  const storageCost = storage_gb * AWS_PRICING.S3.STORAGE_PRICE.STANDARD;
  
  // Calculate request costs
  const getCost = monthly_get_requests * AWS_PRICING.S3.REQUEST_PRICE.GET;
  const putCost = monthly_put_requests * AWS_PRICING.S3.REQUEST_PRICE.PUT;
  
  // Calculate total cost
  const totalCost = storageCost + getCost + putCost;
  
  // Apply free tier if eligible
  let freeTierSavings = 0;
  if (apply_free_tier) {
    // Calculate free tier savings for storage
    const freeTierStorageSavings = Math.min(
      AWS_PRICING.S3.FREE_TIER.STORAGE * AWS_PRICING.S3.STORAGE_PRICE.STANDARD,
      storageCost
    );
    
    // Calculate free tier savings for requests
    const freeTierGetSavings = Math.min(
      AWS_PRICING.S3.FREE_TIER.GET_REQUESTS * AWS_PRICING.S3.REQUEST_PRICE.GET,
      getCost
    );
    
    const freeTierPutSavings = Math.min(
      AWS_PRICING.S3.FREE_TIER.PUT_REQUESTS * AWS_PRICING.S3.REQUEST_PRICE.PUT,
      putCost
    );
    
    freeTierSavings = freeTierStorageSavings + freeTierGetSavings + freeTierPutSavings;
  }
  
  // Calculate final cost
  const finalCost = Math.max(0, totalCost - freeTierSavings);
  
  return {
    service: 'S3',
    monthly_cost: finalCost,
    annual_cost: finalCost * 12,
    free_tier_eligible: true,
    free_tier_limit: `${AWS_PRICING.S3.FREE_TIER.STORAGE}GB storage + ${AWS_PRICING.S3.FREE_TIER.GET_REQUESTS.toLocaleString()} GET requests`,
    breakdown: [
      { 
        component: 'Storage', 
        quantity: `${storage_gb}GB Standard Storage across ${bucket_count} bucket(s)`,
        cost: storageCost
      },
      { 
        component: 'GET Requests', 
        quantity: `${monthly_get_requests.toLocaleString()} requests`,
        cost: getCost
      },
      { 
        component: 'PUT/POST Requests', 
        quantity: `${monthly_put_requests.toLocaleString()} requests`,
        cost: putCost
      },
      {
        component: 'Free Tier Savings',
        quantity: apply_free_tier ? 'Applied' : 'Not Applied',
        cost: -freeTierSavings
      }
    ]
  };
};

/**
 * Calculate DynamoDB costs
 * @param {Object} usage - DynamoDB usage details
 * @returns {Object} - Cost breakdown
 */
export const calculateDynamoDBCost = (usage) => {
  const {
    provisioned_mode = false,
    read_capacity_units = 5,
    write_capacity_units = 5,
    monthly_read_request_units = 500000,
    monthly_write_request_units = 100000,
    storage_gb = 10,
    table_count = 1,
    apply_free_tier = true
  } = usage;
  
  let readCost = 0;
  let writeCost = 0;
  
  // Calculate costs based on capacity mode
  if (provisioned_mode) {
    // Provisioned capacity
    readCost = read_capacity_units * AWS_PRICING.DYNAMODB.PROVISIONED.RCU;
    writeCost = write_capacity_units * AWS_PRICING.DYNAMODB.PROVISIONED.WCU;
  } else {
    // On-demand capacity
    readCost = monthly_read_request_units * AWS_PRICING.DYNAMODB.ON_DEMAND.RCU;
    writeCost = monthly_write_request_units * AWS_PRICING.DYNAMODB.ON_DEMAND.WCU;
  }
  
  // Calculate storage cost
  const storageCost = storage_gb * AWS_PRICING.DYNAMODB.STORAGE;
  
  // Calculate total cost
  const totalCost = readCost + writeCost + storageCost;
  
  // Apply free tier if eligible
  let freeTierSavings = 0;
  if (apply_free_tier) {
    if (provisioned_mode) {
      // Free tier for provisioned capacity
      const freeTierRCUSavings = Math.min(
        AWS_PRICING.DYNAMODB.FREE_TIER.RCU * AWS_PRICING.DYNAMODB.PROVISIONED.RCU,
        readCost
      );
      
      const freeTierWCUSavings = Math.min(
        AWS_PRICING.DYNAMODB.FREE_TIER.WCU * AWS_PRICING.DYNAMODB.PROVISIONED.WCU,
        writeCost
      );
      
      freeTierSavings = freeTierRCUSavings + freeTierWCUSavings;
    } else {
      // Equivalent free tier for on-demand (approximate conversion)
      const freeTierRRUSavings = Math.min(
        (AWS_PRICING.DYNAMODB.FREE_TIER.RCU * 730 * 2) * AWS_PRICING.DYNAMODB.ON_DEMAND.RCU, // RCU * hours * reads per hour * price
        readCost
      );
      
      const freeTierWRUSavings = Math.min(
        (AWS_PRICING.DYNAMODB.FREE_TIER.WCU * 730 * 2) * AWS_PRICING.DYNAMODB.ON_DEMAND.WCU, // WCU * hours * writes per hour * price
        writeCost
      );
      
      freeTierSavings = freeTierRRUSavings + freeTierWRUSavings;
    }
    
    // Free tier storage savings
    const freeTierStorageSavings = Math.min(
      AWS_PRICING.DYNAMODB.FREE_TIER.STORAGE * AWS_PRICING.DYNAMODB.STORAGE,
      storageCost
    );
    
    freeTierSavings += freeTierStorageSavings;
  }
  
  // Calculate final cost
  const finalCost = Math.max(0, totalCost - freeTierSavings);
  
  return {
    service: 'DynamoDB',
    monthly_cost: finalCost,
    annual_cost: finalCost * 12,
    free_tier_eligible: true,
    free_tier_limit: `${AWS_PRICING.DYNAMODB.FREE_TIER.WCU} WCU + ${AWS_PRICING.DYNAMODB.FREE_TIER.RCU} RCU + ${AWS_PRICING.DYNAMODB.FREE_TIER.STORAGE}GB storage`,
    breakdown: [
      { 
        component: provisioned_mode ? 'Read Capacity Units' : 'Read Request Units', 
        quantity: provisioned_mode 
          ? `${read_capacity_units} RCU × 730 hours`
          : `${monthly_read_request_units.toLocaleString()} RRUs`,
        cost: readCost
      },
      { 
        component: provisioned_mode ? 'Write Capacity Units' : 'Write Request Units', 
        quantity: provisioned_mode 
          ? `${write_capacity_units} WCU × 730 hours`
          : `${monthly_write_request_units.toLocaleString()} WRUs`,
        cost: writeCost
      },
      { 
        component: 'Storage', 
        quantity: `${storage_gb}GB across ${table_count} table(s)`,
        cost: storageCost
      },
      {
        component: 'Free Tier Savings',
        quantity: apply_free_tier ? 'Applied' : 'Not Applied',
        cost: -freeTierSavings
      }
    ]
  };
};

/**
 * Calculate API Gateway costs
 * @param {Object} usage - API Gateway usage details
 * @returns {Object} - Cost breakdown
 */
export const calculateApiGatewayCost = (usage) => {
  const {
    monthly_requests = 1000000,
    data_transfer_gb = 1,
    api_count = 1,
    apply_free_tier = true
  } = usage;
  
  // Calculate request cost
  const requestCost = monthly_requests * AWS_PRICING.API_GATEWAY.REQUEST_PRICE;
  
  // Calculate data transfer cost
  const dataCost = data_transfer_gb * AWS_PRICING.API_GATEWAY.DATA_TRANSFER;
  
  // Calculate total cost
  const totalCost = requestCost + dataCost;
  
  // Apply free tier if eligible
  let freeTierSavings = 0;
  if (apply_free_tier) {
    // Calculate free tier savings for requests
    const freeTierRequestSavings = Math.min(
      AWS_PRICING.API_GATEWAY.FREE_TIER.REQUESTS * AWS_PRICING.API_GATEWAY.REQUEST_PRICE,
      requestCost
    );
    
    freeTierSavings = freeTierRequestSavings;
  }
  
  // Calculate final cost
  const finalCost = Math.max(0, totalCost - freeTierSavings);
  
  return {
    service: 'API Gateway',
    monthly_cost: finalCost,
    annual_cost: finalCost * 12,
    free_tier_eligible: true,
    free_tier_limit: `${AWS_PRICING.API_GATEWAY.FREE_TIER.REQUESTS.toLocaleString()} requests per month`,
    breakdown: [
      { 
        component: 'API Requests', 
        quantity: `${monthly_requests.toLocaleString()} requests across ${api_count} API(s)`,
        cost: requestCost
      },
      { 
        component: 'Data Transfer', 
        quantity: `${data_transfer_gb}GB data transfer out`,
        cost: dataCost
      },
      {
        component: 'Free Tier Savings',
        quantity: apply_free_tier ? 'Applied' : 'Not Applied',
        cost: -freeTierSavings
      }
    ]
  };
};

/**
 * Calculate EC2 costs
 * @param {Object} usage - EC2 usage details
 * @returns {Object} - Cost breakdown
 */
export const calculateEC2Cost = (usage) => {
  const {
    instance_type = 't3.micro',
    instance_count = 1,
    usage_hours = 730, // Full month
    ebs_storage_gb = 30,
    ebs_type = 'GP2',
    apply_free_tier = true
  } = usage;
  
  // Get instance price or default to t3.micro
  const instancePrice = 
    AWS_PRICING.EC2.PRICING_BY_TYPE[instance_type] || 
    AWS_PRICING.EC2.PRICING_BY_TYPE['t3.micro'];
  
  // Calculate instance cost (adjust for partial month if needed)
  const instanceHourlyRate = instancePrice / 730; // Price per hour
  const instanceCost = instanceHourlyRate * usage_hours * instance_count;
  
  // Calculate EBS cost
  const ebsPrice = AWS_PRICING.EC2.EBS[ebs_type] || AWS_PRICING.EC2.EBS.GP2;
  const ebsCost = ebs_storage_gb * ebsPrice;
  
  // Calculate total cost
  const totalCost = instanceCost + ebsCost;
  
  // Apply free tier if eligible
  let freeTierSavings = 0;
  if (apply_free_tier && instance_type.includes('t3.micro')) {
    // Calculate free tier savings for instance hours
    const freeHours = Math.min(AWS_PRICING.EC2.FREE_TIER.HOURS, usage_hours);
    const freeTierInstanceSavings = freeHours * instanceHourlyRate;
    
    // Calculate free tier savings for EBS
    const freeTierEBSSavings = Math.min(
      AWS_PRICING.EC2.FREE_TIER.EBS * AWS_PRICING.EC2.EBS.GP2,
      ebsCost
    );
    
    freeTierSavings = freeTierInstanceSavings + freeTierEBSSavings;
  }
  
  // Calculate final cost
  const finalCost = Math.max(0, totalCost - freeTierSavings);
  
  return {
    service: 'EC2',
    monthly_cost: finalCost,
    annual_cost: finalCost * 12,
    free_tier_eligible: instance_type.includes('t3.micro') || instance_type.includes('t2.micro'),
    free_tier_limit: `${AWS_PRICING.EC2.FREE_TIER.HOURS} hours of t2.micro/t3.micro + ${AWS_PRICING.EC2.FREE_TIER.EBS}GB EBS storage per month`,
    breakdown: [
      { 
        component: 'EC2 Instances', 
        quantity: `${instance_count} × ${instance_type} × ${usage_hours} hours`,
        cost: instanceCost
      },
      { 
        component: 'EBS Storage', 
        quantity: `${ebs_storage_gb}GB ${ebs_type}`,
        cost: ebsCost
      },
      {
        component: 'Free Tier Savings',
        quantity: apply_free_tier ? 'Applied' : 'Not Applied',
        cost: -freeTierSavings
      }
    ]
  };
};

/**
 * Get service calculator function by service name
 * @param {string} serviceName - Name of the AWS service
 * @returns {Function} - Service calculator function or null
 */
export const getServiceCalculator = (serviceName) => {
  const calculators = {
    'Lambda': calculateLambdaCost,
    'S3': calculateS3Cost,
    'DynamoDB': calculateDynamoDBCost,
    'API Gateway': calculateApiGatewayCost,
    'EC2': calculateEC2Cost
  };
  
  return calculators[serviceName] || null;
};

/**
 * Calculate costs for all detected services
 * @param {Array} services - List of services
 * @param {Object} usageDetails - Usage details for each service
 * @returns {Object} - Cost estimates for all services
 */
export const calculateAllServiceCosts = (services, usageDetails) => {
  const costEstimates = {};
  
  services.forEach(serviceName => {
    const calculator = getServiceCalculator(serviceName);
    const usage = usageDetails[serviceName] || {};
    
    if (calculator) {
      costEstimates[serviceName] = calculator(usage);
    } else {
      // Default estimation for unknown services
      costEstimates[serviceName] = {
        service: serviceName,
        monthly_cost: 10, // Default assumption
        annual_cost: 120,
        free_tier_eligible: false,
        free_tier_limit: 'Not available',
        breakdown: [
          { 
            component: 'Base usage', 
            quantity: 'Estimated usage',
            cost: 10
          }
        ]
      };
    }
  });
  
  return costEstimates;
}; 
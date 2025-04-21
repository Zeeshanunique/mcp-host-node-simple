/**
 * Jest configuration for aws_cost_analysis module
 */

export default {
  transform: {},
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  extensionsToTreatAsEsm: ['.js'],
  verbose: true
}; 
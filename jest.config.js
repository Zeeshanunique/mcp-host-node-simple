/** @type {import('jest').Config} */
export default {
  // Use fake timers for tests
  testEnvironment: 'node',
  
  // Handle ES modules
  transform: {},
  extensionsToTreatAsEsm: ['.ts', '.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Test configuration
  testMatch: [
    '**/tests/**/*.test.js',
    '**/fixtures/servers/**/tests/**/*.test.js'
  ],
  
  // Verbose test output
  verbose: true
}; 
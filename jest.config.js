// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Mock browser environment for React
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['<rootDir>/src/renderer/src/setupTests.ts'],
  reporters: ['<rootDir>/test-reporter.js'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
        tsconfig: {
          jsx: 'react-jsx', // Force Jest to compile React TSX files
          esModuleInterop: true, // Fixes the TS1259 default import error
          allowJs: true,
          skipLibCheck: true // Prevents errors from node_modules types
        }
      }
    ]
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // This helps Jest handle CSS imports if you have any in your components
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/renderer/src/__mocks__/fileMock.js',
    // If your project uses the "@renderer" alias, this tells Jest where it is:
    '^@render/(.*)$': '<rootDir>/src/renderer/src/$1',
    // If you are importing from ./components inside App.tsx, this helps:
    '^\\./components.(.*)$': '<rootDir>/src/renderer/src/components/$1'
  }
}

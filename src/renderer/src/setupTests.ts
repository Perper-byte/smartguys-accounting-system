// src/renderer/src/setupTests.ts
import '@testing-library/jest-dom'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://root:@localhost:3307/smartguys_db'
}


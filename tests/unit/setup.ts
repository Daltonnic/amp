/// <reference types="node" />
import '@testing-library/jest-dom/vitest'

// Run every test in a U.S. timezone so date logic is exercised where local
// time and UTC fall on different calendar days in the evening.
process.env.TZ = 'America/Chicago'

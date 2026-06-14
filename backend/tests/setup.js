// Set JWT secret and force local storage before app loads
process.env.JWT_SECRET = 'test-secret';
process.env.STORAGE = 'local';

// Mock Prisma client for all tests
jest.mock('../src/config/prisma', () => ({
  class: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  student: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  export: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
}));

// Generate test JWT tokens (available globally in all test files)
const jwt = require('jsonwebtoken');
global.adminAuth   = `Bearer ${jwt.sign({ id: 1, email: 'admin@test.com',   role: 'ADMIN'   }, 'test-secret')}`;
global.teacherAuth = `Bearer ${jwt.sign({ id: 2, email: 'teacher@test.com', role: 'TEACHER' }, 'test-secret')}`;

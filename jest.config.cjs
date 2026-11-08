module.exports = { rootDir: '.', testRegex: 'test/.*\\.spec\\.ts$', transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }] }, testEnvironment: 'node', maxWorkers: 1 };

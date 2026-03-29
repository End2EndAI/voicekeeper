// Manual mock for expo-file-system/legacy
// Individual tests override these with jest.fn() implementations.
module.exports = {
  EncodingType: { Base64: 'base64' },
  cacheDirectory: 'cache://',
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
};

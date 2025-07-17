import 'react-native-gesture-handler/jestSetup';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
    useAuthRequest: jest.fn(() => [
        { url: 'mock-auth-url' },
        { type: 'success', params: { code: 'mock-code' } },
        jest.fn(),
    ]),
    exchangeCodeAsync: jest.fn(),
    AuthRequest: jest.fn(),
    ResponseType: {
        Code: 'code',
    },
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
    openBrowserAsync: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
);

// Mock console methods in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
};

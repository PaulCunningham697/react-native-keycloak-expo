// Simple storage interface that can work with or without AsyncStorage
// This allows the package to be more flexible with dependencies

export interface StorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

let storageImplementation: StorageInterface | null = null;

// Try to use AsyncStorage if available, otherwise fall back to memory storage
const initializeStorage = async (): Promise<StorageInterface> => {
  if (storageImplementation) {
    return storageImplementation;
  }

  try {
    // Try to import AsyncStorage
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    storageImplementation = {
      getItem: AsyncStorage.default.getItem,
      setItem: AsyncStorage.default.setItem,
      removeItem: AsyncStorage.default.removeItem,
    };
    return storageImplementation;
  } catch (error) {
    console.warn(
      "AsyncStorage not available, falling back to memory storage. Install @react-native-async-storage/async-storage for persistent storage.",
    );

    // Fallback to memory storage
    const memoryStorage: { [key: string]: string } = {};
    storageImplementation = {
      getItem: async (key: string) => memoryStorage[key] || null,
      setItem: async (key: string, value: string) => {
        memoryStorage[key] = value;
      },
      removeItem: async (key: string) => {
        delete memoryStorage[key];
      },
    };
    return storageImplementation;
  }
};

export const getStorage = async (): Promise<StorageInterface> => {
  return await initializeStorage();
};

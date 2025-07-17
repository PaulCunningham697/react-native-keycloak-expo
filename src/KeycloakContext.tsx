import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { getStorage } from "./storage";
import { KeycloakConfig, KeycloakTokens, KeycloakUser, KeycloakContextType, KeycloakProviderProps } from "./types";
import {
  buildAuthUrl,
  buildTokenUrl,
  getUserFromToken,
  isTokenExpired,
  refreshTokenRequest,
  logoutRequest,
} from "./utils";

// Configure WebBrowser for better UX
WebBrowser.maybeCompleteAuthSession();

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TOKENS: "@keycloak_tokens",
  USER: "@keycloak_user",
};

export const KeycloakProvider: React.FC<KeycloakProviderProps> = ({ config, children, onTokensChanged, onError }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<KeycloakUser | null>(null);
  const [tokens, setTokens] = useState<KeycloakTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discovery = {
    authorizationEndpoint: buildAuthUrl(config),
    tokenEndpoint: buildTokenUrl(config),
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.clientId,
      scopes: config.scopes || ["openid", "profile", "email"],
      redirectUri: config.redirectUri,
      responseType: AuthSession.ResponseType.Code,
      additionalParameters: config.additionalParameters || {},
    },
    discovery,
  );

  const handleError = useCallback(
    (errorMessage: string) => {
      setError(errorMessage);
      onError?.(errorMessage);
    },
    [onError],
  );

  const saveTokens = useCallback(
    async (newTokens: KeycloakTokens | null) => {
      try {
        const storage = await getStorage();
        if (newTokens) {
          await storage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(newTokens));
        } else {
          await storage.removeItem(STORAGE_KEYS.TOKENS);
        }
        setTokens(newTokens);
        onTokensChanged?.(newTokens);
      } catch (error) {
        console.error("Error saving tokens:", error);
      }
    },
    [onTokensChanged],
  );

  const saveUser = useCallback(async (newUser: KeycloakUser | null) => {
    try {
      const storage = await getStorage();
      if (newUser) {
        await storage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      } else {
        await storage.removeItem(STORAGE_KEYS.USER);
      }
      setUser(newUser);
    } catch (error) {
      console.error("Error saving user:", error);
    }
  }, []);

  const loadStoredData = useCallback(async () => {
    try {
      const storage = await getStorage();
      const [storedTokens, storedUser] = await Promise.all([
        storage.getItem(STORAGE_KEYS.TOKENS),
        storage.getItem(STORAGE_KEYS.USER),
      ]);

      if (storedTokens) {
        const parsedTokens: KeycloakTokens = JSON.parse(storedTokens);

        // Check if access token is expired
        if (isTokenExpired(parsedTokens.accessToken)) {
          // Try to refresh if refresh token exists
          if (parsedTokens.refreshToken && !isTokenExpired(parsedTokens.refreshToken)) {
            try {
              const newTokens = await refreshTokenRequest(config, parsedTokens.refreshToken);
              await saveTokens(newTokens);

              if (newTokens.idToken) {
                const userData = getUserFromToken(newTokens.idToken);
                await saveUser(userData);
                setIsAuthenticated(true);
              }
            } catch (refreshError) {
              // Refresh failed, clear stored data
              await saveTokens(null);
              await saveUser(null);
              setIsAuthenticated(false);
            }
          } else {
            // No valid refresh token, clear stored data
            await saveTokens(null);
            await saveUser(null);
            setIsAuthenticated(false);
          }
        } else {
          // Access token is still valid
          setTokens(parsedTokens);
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error("Error loading stored data:", error);
      handleError("Failed to load stored authentication data");
    } finally {
      setIsLoading(false);
    }
  }, [config, handleError, saveTokens, saveUser]);

  const exchangeCodeForTokens = useCallback(
    async (code: string) => {
      try {
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: config.clientId,
            code,
            redirectUri: config.redirectUri,
            extraParams: {},
          },
          discovery,
        );

        const newTokens: KeycloakTokens = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          idToken: tokenResponse.idToken,
          tokenType: tokenResponse.tokenType || "Bearer",
          expiresIn: tokenResponse.expiresIn,
          scope: tokenResponse.scope,
        };

        await saveTokens(newTokens);

        if (newTokens.idToken) {
          const userData = getUserFromToken(newTokens.idToken);
          await saveUser(userData);
        }

        setIsAuthenticated(true);
        setError(null);
      } catch (error) {
        console.error("Token exchange error:", error);
        handleError("Failed to exchange authorization code for tokens");
      }
    },
    [config, discovery, handleError, saveTokens, saveUser],
  );

  const login = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await promptAsync({
        showInRecents: true,
        ...(Platform.OS === "web" ? {} : { useProxy: true }),
      });

      if (result.type === "success" && result.params.code) {
        await exchangeCodeForTokens(result.params.code);
      } else if (result.type === "error") {
        handleError(result.params.error_description || "Authentication failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      handleError("Login failed");
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync, exchangeCodeForTokens, handleError]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);

      // Call Keycloak logout endpoint if refresh token exists
      if (tokens?.refreshToken) {
        try {
          await logoutRequest(config, tokens.refreshToken);
        } catch (error) {
          console.warn("Keycloak logout request failed:", error);
        }
      }

      // Clear local storage
      await saveTokens(null);
      await saveUser(null);

      setIsAuthenticated(false);
      setError(null);
    } catch (error) {
      console.error("Logout error:", error);
      handleError("Logout failed");
    } finally {
      setIsLoading(false);
    }
  }, [config, tokens, handleError, saveTokens, saveUser]);

  const refresh = useCallback(async () => {
    if (!tokens?.refreshToken) {
      handleError("No refresh token available");
      return;
    }

    try {
      setIsLoading(true);
      const newTokens = await refreshTokenRequest(config, tokens.refreshToken);
      await saveTokens(newTokens);

      if (newTokens.idToken) {
        const userData = getUserFromToken(newTokens.idToken);
        await saveUser(userData);
      }

      setError(null);
    } catch (error) {
      console.error("Token refresh error:", error);
      handleError("Failed to refresh tokens");

      // If refresh fails, logout user
      await logout();
    } finally {
      setIsLoading(false);
    }
  }, [config, tokens, handleError, saveTokens, saveUser, logout]);

  // Handle auth session response
  useEffect(() => {
    if (response?.type === "success" && response.params.code) {
      exchangeCodeForTokens(response.params.code);
    } else if (response?.type === "error") {
      handleError(response.params.error_description || "Authentication failed");
    }
  }, [response, exchangeCodeForTokens, handleError]);

  // Load stored data on mount
  useEffect(() => {
    loadStoredData();
  }, [loadStoredData]);

  // Auto-refresh tokens before expiry
  useEffect(() => {
    if (!tokens?.accessToken || !tokens?.refreshToken) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired(tokens.accessToken)) {
        refresh();
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);
    return () => clearInterval(interval);
  }, [tokens, refresh]);

  const contextValue: KeycloakContextType = {
    isAuthenticated,
    user,
    tokens,
    login,
    logout,
    refresh,
    isLoading,
    error,
  };

  return <KeycloakContext.Provider value={contextValue}>{children}</KeycloakContext.Provider>;
};

export const useKeycloak = (): KeycloakContextType => {
  const context = useContext(KeycloakContext);
  if (!context) {
    throw new Error("useKeycloak must be used within a KeycloakProvider");
  }
  return context;
};

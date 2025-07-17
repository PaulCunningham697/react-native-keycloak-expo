import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { getStorage } from './storage';
import {
    KeycloakConfig,
    KeycloakTokens,
    KeycloakUser,
    KeycloakContextType,
    KeycloakProviderProps,
    KeycloakLoginOptions,
} from './types';
import {
    buildAuthUrl,
    buildTokenUrl,
    getUserFromToken,
    isTokenExpired,
    refreshTokenRequest,
    logoutRequest,
} from './utils';

// Configure WebBrowser for better UX
WebBrowser.maybeCompleteAuthSession();

const KeycloakContext = createContext<KeycloakContextType | undefined>(undefined);

const STORAGE_KEYS = {
    TOKENS: '@keycloak_tokens',
    USER: '@keycloak_user',
};

export const KeycloakProvider: React.FC<KeycloakProviderProps> = ({
                                                                      config,
                                                                      children,
                                                                      onTokensChanged,
                                                                      onError,
                                                                  }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<KeycloakUser | null>(null);
    const [tokens, setTokens] = useState<KeycloakTokens | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const discovery = {
        authorizationEndpoint: buildAuthUrl(config),
        tokenEndpoint: buildTokenUrl(config),
    };

    // Initialize auth request but don't create it until needed
    const [authRequest, setAuthRequest] = useState<AuthSession.AuthRequest | null>(null);
    const [authResponse, setAuthResponse] = useState<AuthSession.AuthSessionResult | null>(null);

    const handleError = useCallback((errorMessage: string) => {
        console.error('Keycloak error:', errorMessage);
        setError(errorMessage);
        onError?.(errorMessage);
    }, [onError]);

    const saveTokens = useCallback(async (newTokens: KeycloakTokens | null) => {
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
            console.error('Error saving tokens:', error);
        }
    }, [onTokensChanged]);

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
            console.error('Error saving user:', error);
        }
    }, []);

    const updateAuthState = useCallback(async (newTokens: KeycloakTokens | null, newUser: KeycloakUser | null) => {
        await saveTokens(newTokens);
        await saveUser(newUser);
        setIsAuthenticated(!!newTokens);
        setError(null);
    }, [saveTokens, saveUser]);

    const initializeAuth = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const storage = await getStorage();
            const [storedTokens, storedUser] = await Promise.all([
                storage.getItem(STORAGE_KEYS.TOKENS),
                storage.getItem(STORAGE_KEYS.USER),
            ]);

            if (storedTokens) {
                const parsedTokens: KeycloakTokens = JSON.parse(storedTokens);

                console.log('📱 Found stored tokens');

                // Check if access token is expired
                if (isTokenExpired(parsedTokens.accessToken)) {
                    console.log('🔄 Access token expired, trying to refresh...');

                    // Try to refresh if refresh token exists
                    if (parsedTokens.refreshToken && !isTokenExpired(parsedTokens.refreshToken)) {
                        try {
                            const newTokens = await refreshTokenRequest(config, parsedTokens.refreshToken);
                            console.log('✅ Token refresh successful');

                            let userData = null;
                            if (newTokens.idToken) {
                                userData = getUserFromToken(newTokens.idToken);
                            } else if (storedUser) {
                                userData = JSON.parse(storedUser);
                            }

                            await updateAuthState(newTokens, userData);
                            console.log('✅ Auth initialization successful - user authenticated');
                            setInitialized(true);
                            return;
                        } catch (refreshError) {
                            console.warn('⚠️ Token refresh failed during initialization:', refreshError);
                            // Clear stored data and continue with unauthenticated state
                            await updateAuthState(null, null);
                        }
                    } else {
                        console.log('⚠️ No valid refresh token, clearing stored data');
                        await updateAuthState(null, null);
                    }
                } else {
                    console.log('✅ Access token is still valid');
                    // Access token is still valid
                    let userData = null;
                    if (storedUser) {
                        userData = JSON.parse(storedUser);
                    } else if (parsedTokens.idToken) {
                        userData = getUserFromToken(parsedTokens.idToken);
                        await saveUser(userData);
                    }

                    await updateAuthState(parsedTokens, userData);
                    console.log('✅ Auth initialization successful - user authenticated');
                    setInitialized(true);
                    return;
                }
            } else {
                console.log('📱 No stored tokens found');
            }

            // No valid tokens found
            setIsAuthenticated(false);
            setTokens(null);
            setUser(null);
            console.log('✅ Auth initialization complete - user not authenticated');
            setInitialized(true);
        } catch (error) {
            console.error('❌ Auth initialization failed:', error);
            handleError(`Authentication initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setInitialized(true);
        } finally {
            setIsLoading(false);
        }
    }, [config, handleError, updateAuthState]);

    const createAuthRequest = useCallback(async () => {
        try {
            console.log('🔧 Creating auth request...');

            const request = new AuthSession.AuthRequest({
                clientId: config.clientId,
                scopes: config.scopes || ['openid', 'profile', 'email'],
                redirectUri: config.redirectUri,
                responseType: AuthSession.ResponseType.Code,
                extraParams: config.additionalParameters || {},
                usePKCE: true, // Enable PKCE
            });

            await request.makeAuthUrlAsync(discovery);

            console.log('✅ Auth request created successfully');
            console.log('Auth URL:', request.url);
            console.log('PKCE enabled:', !!request.codeVerifier);
            console.log('Code challenge method:', request.codeChallengeMethod);
            console.log('Code challenge:', request.codeChallenge?.substring(0, 20) + '...');

            setAuthRequest(request);
            return request;
        } catch (error) {
            console.error('❌ Failed to create auth request:', error);
            throw error;
        }
    }, [config, discovery]);

    const exchangeCodeForTokens = useCallback(async (code: string, request: AuthSession.AuthRequest) => {
        try {
            console.log('=== TOKEN EXCHANGE DEBUG ===');
            console.log('Authorization code:', code.substring(0, 20) + '...');
            console.log('Code length:', code.length);
            console.log('Client ID:', config.clientId);
            console.log('Redirect URI:', config.redirectUri);
            console.log('Has code verifier:', !!request.codeVerifier);
            console.log('Code verifier length:', request.codeVerifier?.length || 0);

            const tokenUrl = `${config.url}/realms/${config.realm}/protocol/openid-connect/token`;
            console.log('Token URL:', tokenUrl);

            const data = new URLSearchParams();
            data.append("client_id", config.clientId);
            data.append("grant_type", "authorization_code");
            data.append("code", code);
            data.append("redirect_uri", config.redirectUri);

            // Add PKCE code verifier if present
            if (request.codeVerifier) {
                data.append("code_verifier", request.codeVerifier);
                console.log('✅ PKCE code verifier added');
            } else {
                console.log('⚠️ No PKCE code verifier found');
            }

            console.log('Request body parameters:', {
                client_id: config.clientId,
                grant_type: "authorization_code",
                code: code.substring(0, 20) + '...',
                redirect_uri: config.redirectUri,
                code_verifier: request.codeVerifier ? 'present' : 'missing',
            });

            const response = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    ...config.customHeaders,
                },
                body: data.toString(),
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorResponse = await response.json();
                console.error('=== TOKEN EXCHANGE ERROR ===');
                console.error('Status:', response.status);
                console.error('Error response:', errorResponse);
                console.error('Error details:', {
                    error: errorResponse.error,
                    error_description: errorResponse.error_description,
                    error_uri: errorResponse.error_uri,
                });

                // Provide specific error hints
                if (errorResponse.error === 'invalid_grant') {
                    console.error('💡 INVALID_GRANT ERROR HINTS:');
                    console.error('1. Check redirect URI matches exactly in Keycloak client');
                    console.error('2. Verify client ID is correct');
                    console.error('3. Check if authorization code expired (usually 60 seconds)');
                    console.error('4. Ensure client authentication is disabled in Keycloak');
                    console.error('5. Verify PKCE configuration matches between app and Keycloak');
                }

                throw new Error(
                    `Token exchange failed: ${response.status} - ${errorResponse.error_description || errorResponse.error}`
                );
            }

            const tokens = await response.json();
            console.log('✅ Token exchange successful');
            console.log('Received tokens:', {
                access_token: tokens.access_token ? 'present' : 'missing',
                refresh_token: tokens.refresh_token ? 'present' : 'missing',
                id_token: tokens.id_token ? 'present' : 'missing',
                token_type: tokens.token_type,
                expires_in: tokens.expires_in,
                scope: tokens.scope,
            });

            if (tokens.access_token) {
                const newTokens: KeycloakTokens = {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    idToken: tokens.id_token,
                    tokenType: tokens.token_type || 'Bearer',
                    expiresIn: tokens.expires_in,
                    scope: tokens.scope,
                };

                let userData = null;
                if (newTokens.idToken) {
                    userData = getUserFromToken(newTokens.idToken);
                    console.log('✅ User data extracted from ID token');
                }

                await updateAuthState(newTokens, userData);
                console.log('✅ Authentication completed successfully');
            } else {
                throw new Error('No access token received in response');
            }

        } catch (error) {
            console.error('=== TOKEN EXCHANGE ERROR ===');
            console.error('Error:', error);
            console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('Config debug:', {
                clientId: config.clientId,
                redirectUri: config.redirectUri,
                tokenUrl: `${config.url}/realms/${config.realm}/protocol/openid-connect/token`,
                realm: config.realm,
                baseUrl: config.url,
            });

            throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [config, updateAuthState]);

    const login = useCallback(async (options?: KeycloakLoginOptions) => {
        try {
            console.log('🔐 Starting login process...');
            console.log('Login options:', options);
            setIsLoading(true);
            setError(null);

            // Build extra parameters based on options
            const extraParams = {
                ...config.additionalParameters,
                ...options?.additionalParams,
            };

            // Add Keycloak-specific parameters
            if (options?.action === 'register') {
                extraParams.kc_action = 'REGISTER';
            }

            if (options?.prompt) {
                extraParams.prompt = options.prompt;
            }

            if (options?.maxAge !== undefined) {
                extraParams.max_age = options.maxAge.toString();
            }

            if (options?.loginHint) {
                extraParams.login_hint = options.loginHint;
            }

            if (options?.idpHint) {
                extraParams.kc_idp_hint = options.idpHint;
            }

            if (options?.locale) {
                extraParams.kc_locale = options.locale;
            }

            console.log('Extra parameters:', extraParams);

            // Create auth request with the extra parameters
            const request = new AuthSession.AuthRequest({
                clientId: config.clientId,
                scopes: config.scopes || ['openid', 'profile', 'email'],
                redirectUri: config.redirectUri,
                responseType: AuthSession.ResponseType.Code,
                extraParams,
                usePKCE: true,
            });

            await request.makeAuthUrlAsync(discovery);

            console.log('✅ Auth request created with options');
            console.log('Auth URL:', request.url);
            console.log('PKCE enabled:', !!request.codeVerifier);

            console.log('🌐 Opening auth URL...');
            const result = await request.promptAsync(discovery, {
                showInRecents: true,
                ...(Platform.OS === 'web' ? {} : { useProxy: true }),
            });

            console.log('🔍 Auth result:', result.type);

            if (result.type === 'success' && result.params.code) {
                console.log('✅ Authorization code received');
                await exchangeCodeForTokens(result.params.code, request);
            } else if (result.type === 'error') {
                console.error('❌ Auth error:', result.params);
                const errorMessage = result.params.error_description || result.params.error || 'Authentication failed';
                handleError(errorMessage);
            } else if (result.type === 'cancel') {
                console.log('⚠️ Auth cancelled by user');
                // Don't show error for user cancellation
            } else {
                console.warn('⚠️ Unexpected auth result:', result.type);
            }
        } catch (error) {
            console.error('❌ Login failed:', error);
            handleError(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    }, [config, discovery, exchangeCodeForTokens, handleError]);

    const logout = useCallback(async () => {
        try {
            console.log('🔓 Starting logout process...');
            setIsLoading(true);

            // Call Keycloak logout endpoint if refresh token exists
            if (tokens?.refreshToken) {
                try {
                    await logoutRequest(config, tokens.refreshToken);
                    console.log('✅ Keycloak logout successful');
                } catch (error) {
                    console.warn('⚠️ Keycloak logout request failed:', error);
                }
            }

            // Clear local storage
            await updateAuthState(null, null);
            console.log('✅ Logout completed');
        } catch (error) {
            console.error('❌ Logout failed:', error);
            handleError(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    }, [config, tokens, updateAuthState, handleError]);

    const refresh = useCallback(async () => {
        if (!tokens?.refreshToken) {
            handleError('No refresh token available');
            return;
        }

        try {
            console.log('🔄 Refreshing tokens...');
            setIsLoading(true);

            const newTokens = await refreshTokenRequest(config, tokens.refreshToken);

            let userData = user;
            if (newTokens.idToken) {
                userData = getUserFromToken(newTokens.idToken);
            }

            await updateAuthState(newTokens, userData);
            console.log('✅ Token refresh successful');
        } catch (error) {
            console.error('❌ Token refresh failed:', error);
            handleError(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

            // If refresh fails, logout user
            await logout();
        } finally {
            setIsLoading(false);
        }
    }, [config, tokens, user, updateAuthState, handleError, logout]);

    // Initialize auth on mount
    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    // Handle auth session response if using the old response pattern
    useEffect(() => {
        if (authResponse?.type === 'success' && authResponse.params.code && authRequest) {
            exchangeCodeForTokens(authResponse.params.code, authRequest);
        } else if (authResponse?.type === 'error') {
            handleError(authResponse.params.error_description || 'Authentication failed');
        }
    }, [authResponse, authRequest, exchangeCodeForTokens, handleError]);

    // Auto-refresh tokens before expiry
    useEffect(() => {
        if (!tokens?.accessToken || !tokens?.refreshToken || !isAuthenticated) return;

        const checkTokenExpiry = () => {
            if (isTokenExpired(tokens.accessToken)) {
                refresh();
            }
        };

        // Check every minute
        const interval = setInterval(checkTokenExpiry, 60000);
        return () => clearInterval(interval);
    }, [tokens, isAuthenticated, refresh]);

    const contextValue: KeycloakContextType = {
        isAuthenticated,
        user,
        tokens,
        login,
        logout,
        refresh,
        isLoading,
        error,
        initialized,
    };

    return (
        <KeycloakContext.Provider value={contextValue}>
            {children}
        </KeycloakContext.Provider>
    );
};

export const useKeycloak = (): KeycloakContextType => {
    const context = useContext(KeycloakContext);
    if (!context) {
        throw new Error('useKeycloak must be used within a KeycloakProvider');
    }
    return context;
};

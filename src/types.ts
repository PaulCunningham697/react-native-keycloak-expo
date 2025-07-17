export interface KeycloakConfig {
    url: string;
    realm: string;
    clientId: string;
    redirectUri: string;
    scopes?: string[];
    additionalParameters?: Record<string, string>;
    customHeaders?: Record<string, string>;
}

export interface KeycloakTokens {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    tokenType: string;
    expiresIn?: number;
    scope?: string;
}

export interface KeycloakUser {
    sub: string;
    email?: string;
    emailVerified?: boolean;
    name?: string;
    givenName?: string;
    familyName?: string;
    preferredUsername?: string;
    picture?: string;
    locale?: string;
    [key: string]: any;
}

export interface KeycloakLoginOptions {
    action?: 'login' | 'register';
    prompt?: 'none' | 'login' | 'consent' | 'select_account';
    maxAge?: number;
    loginHint?: string;
    idpHint?: string;
    locale?: string;
    additionalParams?: Record<string, string>;
}

export interface KeycloakContextType {
    isAuthenticated: boolean;
    user: KeycloakUser | null;
    tokens: KeycloakTokens | null;
    login: (options?: KeycloakLoginOptions) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    isLoading: boolean;
    initialized: boolean;
    error: string | null;
}

export interface KeycloakProviderProps {
    config: KeycloakConfig;
    children: React.ReactNode;
    onTokensChanged?: (tokens: KeycloakTokens | null) => void;
    onError?: (error: string) => void;
}

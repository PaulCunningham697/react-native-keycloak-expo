import { KeycloakConfig, KeycloakTokens, KeycloakUser } from './types';

export const buildAuthUrl = (config: KeycloakConfig): string => {
    const { url, realm } = config;
    return `${url}/realms/${realm}/protocol/openid-connect/auth`;
};

export const buildTokenUrl = (config: KeycloakConfig): string => {
    const { url, realm } = config;
    return `${url}/realms/${realm}/protocol/openid-connect/token`;
};

export const buildUserInfoUrl = (config: KeycloakConfig): string => {
    const { url, realm } = config;
    return `${url}/realms/${realm}/protocol/openid-connect/userinfo`;
};

export const buildLogoutUrl = (config: KeycloakConfig): string => {
    const { url, realm } = config;
    return `${url}/realms/${realm}/protocol/openid-connect/logout`;
};

export const parseJwtPayload = (token: string): any => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT payload:', error);
        return null;
    }
};

export const isTokenExpired = (token: string): boolean => {
    try {
        const payload = parseJwtPayload(token);
        if (!payload || !payload.exp) return true;

        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    } catch (error) {
        return true;
    }
};

export const getUserFromToken = (idToken: string): KeycloakUser | null => {
    try {
        const payload = parseJwtPayload(idToken);
        if (!payload) return null;

        return {
            sub: payload.sub,
            email: payload.email,
            emailVerified: payload.email_verified,
            name: payload.name,
            givenName: payload.given_name,
            familyName: payload.family_name,
            preferredUsername: payload.preferred_username,
            picture: payload.picture,
            locale: payload.locale,
            ...payload
        };
    } catch (error) {
        console.error('Error extracting user from token:', error);
        return null;
    }
};

export const refreshTokenRequest = async (
    config: KeycloakConfig,
    refreshToken: string
): Promise<KeycloakTokens> => {
    const tokenUrl = buildTokenUrl(config);

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...config.customHeaders,
        },
        body: body.toString(),
    });

    if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in,
        scope: data.scope,
    };
};

export const logoutRequest = async (
    config: KeycloakConfig,
    refreshToken: string
): Promise<void> => {
    const logoutUrl = buildLogoutUrl(config);

    const body = new URLSearchParams({
        client_id: config.clientId,
        refresh_token: refreshToken,
    });

    await fetch(logoutUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...config.customHeaders,
        },
        body: body.toString(),
    });
};

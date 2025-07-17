import {
    buildAuthUrl,
    buildTokenUrl,
    buildUserInfoUrl,
    buildLogoutUrl,
    parseJwtPayload,
    isTokenExpired,
    getUserFromToken,
} from '../utils';
import { KeycloakConfig } from '../types';

const mockConfig: KeycloakConfig = {
    url: 'https://keycloak.example.com',
    realm: 'test-realm',
    clientId: 'test-client',
    redirectUri: 'test-app://auth',
};

describe('URL builders', () => {
    test('buildAuthUrl should construct correct auth URL', () => {
        const result = buildAuthUrl(mockConfig);
        expect(result).toBe(
            'https://keycloak.example.com/realms/test-realm/protocol/openid-connect/auth'
        );
    });

    test('buildTokenUrl should construct correct token URL', () => {
        const result = buildTokenUrl(mockConfig);
        expect(result).toBe(
            'https://keycloak.example.com/realms/test-realm/protocol/openid-connect/token'
        );
    });

    test('buildUserInfoUrl should construct correct userinfo URL', () => {
        const result = buildUserInfoUrl(mockConfig);
        expect(result).toBe(
            'https://keycloak.example.com/realms/test-realm/protocol/openid-connect/userinfo'
        );
    });

    test('buildLogoutUrl should construct correct logout URL', () => {
        const result = buildLogoutUrl(mockConfig);
        expect(result).toBe(
            'https://keycloak.example.com/realms/test-realm/protocol/openid-connect/logout'
        );
    });
});

describe('JWT utilities', () => {
    const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Lzqr6_zXxZQV8eEfZvNiN7vWVGjrLk2qJ8fJvG3VLf0';
    const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    test('parseJwtPayload should decode JWT payload', () => {
        const result = parseJwtPayload(mockJwt);
        expect(result).toEqual({
            sub: '1234567890',
            name: 'John Doe',
            iat: 1516239022,
            exp: 9999999999,
        });
    });

    test('parseJwtPayload should return null for invalid JWT', () => {
        const result = parseJwtPayload('invalid-jwt');
        expect(result).toBeNull();
    });

    test('isTokenExpired should return false for valid token', () => {
        const result = isTokenExpired(mockJwt);
        expect(result).toBe(false);
    });

    test('isTokenExpired should return true for expired token', () => {
        const result = isTokenExpired(expiredJwt);
        expect(result).toBe(true);
    });

    test('getUserFromToken should extract user info from ID token', () => {
        const idToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInByZWZlcnJlZF91c2VybmFtZSI6ImpvaG5kb2UiLCJnaXZlbl9uYW1lIjoiSm9obiIsImZhbWlseV9uYW1lIjoiRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.Qx7VRjlOWvUJcQXeqcqRdQSjLhGLUGxoKC5KcPyPOI4';

        const result = getUserFromToken(idToken);
        expect(result).toEqual({
            sub: '1234567890',
            name: 'John Doe',
            email: 'john@example.com',
            emailVerified: true,
            preferredUsername: 'johndoe',
            givenName: 'John',
            familyName: 'Doe',
            picture: undefined,
            locale: undefined,
            iat: 1516239022,
            exp: 9999999999,
        });
    });

    test('getUserFromToken should return null for invalid token', () => {
        const result = getUserFromToken('invalid-token');
        expect(result).toBeNull();
    });
});

describe('Token refresh', () => {
    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
    });

    test('refreshTokenRequest should make correct API call', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
                id_token: 'new-id-token',
                token_type: 'Bearer',
                expires_in: 3600,
                scope: 'openid profile email',
            }),
        });

        const { refreshTokenRequest } = require('../utils');
        const result = await refreshTokenRequest(mockConfig, 'refresh-token');

        expect(global.fetch).toHaveBeenCalledWith(
            'https://keycloak.example.com/realms/test-realm/protocol/openid-connect/token',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'grant_type=refresh_token&client_id=test-client&refresh_token=refresh-token',
            }
        );

        expect(result).toEqual({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            idToken: 'new-id-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            scope: 'openid profile email',
        });
    });

    test('refreshTokenRequest should throw error on failed request', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 400,
        });

        const { refreshTokenRequest } = require('../utils');

        await expect(
            refreshTokenRequest(mockConfig, 'invalid-refresh-token')
        ).rejects.toThrow('Token refresh failed: 400');
    });
});

# React Native Keycloak Expo

A comprehensive Keycloak authentication provider for React Native applications using Expo's `expo-auth-session` and `expo-web-browser`.

## Features

- 🔐 Complete OAuth 2.0 / OpenID Connect flow
- 🔄 Automatic token refresh
- 💾 Persistent authentication state
- 📱 Works with Expo managed and bare workflows
- 🎯 TypeScript support
- 🛡️ Secure token storage
- 🔀 Configurable scopes and parameters

## Installation

### Quick Install (Recommended)
```bash
npm install react-native-keycloak-expo expo-auth-session expo-web-browser --legacy-peer-deps
```

### Step-by-Step Installation

1. **Install the core package and dependencies:**
```bash
npm install expo-auth-session expo-web-browser
npm install react-native-keycloak-expo --legacy-peer-deps
```

2. **Install AsyncStorage for persistent storage (optional but recommended):**
```bash
npm install @react-native-async-storage/async-storage
```

**Note:** AsyncStorage is optional. If not installed, the package will fall back to memory-based storage (tokens won't persist between app restarts).

### Alternative Installation Methods

#### Option 1: For newer React Native versions (0.80+)
```bash
npm install @types/react@^19.0.0 --save-dev
npm install react-native-keycloak-expo expo-auth-session expo-web-browser
```

#### Option 2: For Expo managed projects
```bash
npx expo install expo-auth-session expo-web-browser @react-native-async-storage/async-storage
npm install react-native-keycloak-expo --legacy-peer-deps
```

#### Option 3: Force installation (if other methods fail)
```bash
npm install react-native-keycloak-expo expo-auth-session expo-web-browser --force
```

### Version Compatibility

| React Native Version | Expo SDK | Recommended Installation |
|---------------------|----------|-------------------------|
| 0.73.x - 0.80.x | 50+ | Use `--legacy-peer-deps` |
| 0.70.x - 0.72.x | 48-49 | Standard installation |
| 0.60.x - 0.69.x | 45-47 | May need older AsyncStorage version |

## Setup

### 1. Configure Keycloak

In your Keycloak admin console:
1. Create a new client or use an existing one
2. Set the client to "Public"
3. Add your redirect URI (e.g., `your-app://auth`)
4. **Enable "Proof Key for Code Exchange Code Challenge Method"** (PKCE)
5. Set **"Code Challenge Method"** to `S256`
6. Enable "Direct Access Grants" if needed for refresh tokens
7. **Disable "Client authentication"** (since it's a public client)

**Important PKCE Settings:**
- Client Type: `public`
- Proof Key for Code Exchange Code Challenge Method: `enabled`
- Code Challenge Method: `S256`

### 2. Configure Your App

Add the redirect URI to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "scheme": "your-app",
    "platforms": ["ios", "android", "web"]
  }
}
```

## Usage

### Basic Setup

```tsx
import React from 'react';
import { KeycloakProvider, useKeycloak } from 'react-native-keycloak-expo';

const keycloakConfig = {
  url: 'https://your-keycloak-server.com',
  realm: 'your-realm',
  clientId: 'your-client-id',
  redirectUri: 'your-app://auth',
  scopes: ['openid', 'profile', 'email'],
};

export default function App() {
  return (
    <KeycloakProvider config={keycloakConfig}>
      <YourApp />
    </KeycloakProvider>
  );
}
```

### Using the Hook

```tsx
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useKeycloak } from 'react-native-keycloak-expo';

function YourApp() {
  const { 
    isAuthenticated, 
    user, 
    tokens, 
    login, 
    logout, 
    refresh,
    isLoading, 
    error 
  } = useKeycloak();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (error) {
    return <Text>Error: {error}</Text>;
  }

  if (!isAuthenticated) {
    return (
      <View>
        <Text>Please log in</Text>
        <Button title="Login" onPress={login} />
      </View>
    );
  }

  return (
    <View>
      <Text>Welcome, {user?.name || user?.preferredUsername}!</Text>
      <Text>Email: {user?.email}</Text>
      <Button title="Refresh Token" onPress={refresh} />
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

## Configuration Options

### KeycloakConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | string | Yes | Keycloak server URL |
| `realm` | string | Yes | Keycloak realm name |
| `clientId` | string | Yes | Keycloak client ID |
| `redirectUri` | string | Yes | OAuth redirect URI |
| `scopes` | string[] | No | OAuth scopes (default: ['openid', 'profile', 'email']) |
| `additionalParameters` | Record<string, string> | No | Additional OAuth parameters |
| `customHeaders` | Record<string, string> | No | Custom headers for token requests |

### KeycloakProviderProps

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `config` | KeycloakConfig | Yes | Keycloak configuration |
| `children` | React.ReactNode | Yes | Child components |
| `onTokensChanged` | (tokens: KeycloakTokens \| null) => void | No | Callback when tokens change |
| `onError` | (error: string) => void | No | Callback for errors |

## Advanced Usage

### Custom Parameters

```tsx
const keycloakConfig = {
  url: 'https://your-keycloak-server.com',
  realm: 'your-realm',
  clientId: 'your-client-id',
  redirectUri: 'your-app://auth',
  scopes: ['openid', 'profile', 'email', 'roles'],
  additionalParameters: {
    kc_idp_hint: 'google',
    prompt: 'login'
  },
  customHeaders: {
    'X-Custom-Header': 'value'
  }
};
```

### Token Management

```tsx
function TokenManager() {
  const { tokens, refresh } = useKeycloak();

  // Access token for API calls
  const accessToken = tokens?.accessToken;

  // Manual token refresh
  const handleRefresh = async () => {
    try {
      await refresh();
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  };

  return (
    <View>
      <Text>Token expires in: {tokens?.expiresIn} seconds</Text>
      <Button title="Refresh Token" onPress={handleRefresh} />
    </View>
  );
}
```

### Error Handling

```tsx
function AppWithErrorHandling() {
  const handleError = (error: string) => {
    console.error('Keycloak error:', error);
    // Handle error (show notification, redirect, etc.)
  };

  const handleTokensChanged = (tokens: KeycloakTokens | null) => {
    if (tokens) {
      console.log('User authenticated, tokens received');
    } else {
      console.log('User logged out, tokens cleared');
    }
  };

  return (
    <KeycloakProvider 
      config={keycloakConfig}
      onError={handleError}
      onTokensChanged={handleTokensChanged}
    >
      <YourApp />
    </KeycloakProvider>
  );
}
```

## API Reference

### useKeycloak Hook

Returns an object with the following properties:

- `isAuthenticated: boolean` - Whether user is authenticated
- `user: KeycloakUser | null` - Current user information
- `tokens: KeycloakTokens | null` - Current tokens
- `login: () => Promise<void>` - Initiate login flow
- `logout: () => Promise<void>` - Logout user
- `refresh: () => Promise<void>` - Refresh tokens
- `isLoading: boolean` - Loading state
- `error: string | null` - Current error message

### Types

```typescript
interface KeycloakUser {
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

interface KeycloakTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresIn?: number;
  scope?: string;
}
```

## Security Considerations

- Tokens are stored securely using AsyncStorage
- Automatic token refresh prevents expired token usage
- Logout properly clears all stored authentication data
- HTTPS is enforced for all Keycloak communications

## Troubleshooting

### Common Issues

1. **PKCE code verifier not specified**:
    - Ensure your Keycloak client has PKCE enabled
    - Set "Code Challenge Method" to `S256` in Keycloak client settings
    - Make sure "Client authentication" is disabled for public clients

2. **Redirect URI mismatch**: Ensure the redirect URI in Keycloak matches your app's URI scheme

3. **Token refresh fails**: Check if refresh tokens are enabled in your Keycloak client

4. **Network errors**: Verify Keycloak server is accessible and CORS is configured properly

### Debug Mode

Enable debug logging by setting up a logger:

```tsx
import { useKeycloak } from 'react-native-keycloak-expo';

function DebugInfo() {
  const { tokens, user, error } = useKeycloak();
  
  console.log('Current tokens:', tokens);
  console.log('Current user:', user);
  console.log('Current error:', error);
  
  return null;
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

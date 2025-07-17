import React from "react";
import { View, Text, Button, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";

import { KeycloakProvider, useKeycloak, KeycloakTokens } from "react-native-keycloak-expo";

// Keycloak configuration
const keycloakConfig = {
  url: "https://your-keycloak-server.com",
  realm: "your-realm",
  clientId: "your-client-id",
  redirectUri: "your-app://auth",
  scopes: ["openid", "profile", "email", "roles"],
  customHeaders: {
    "X-Custom-Header": "MyApp/1.0",
  },
};

// Main App Component
function AppContent() {
  const { isAuthenticated, user, tokens, login, logout, refresh, isLoading, error } = useKeycloak();

  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      Alert.alert("Login Failed", "Unable to authenticate with Keycloak");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      Alert.alert("Logout Failed", "Unable to logout from Keycloak");
    }
  };

  const handleRefresh = async () => {
    try {
      await refresh();
      Alert.alert("Success", "Tokens refreshed successfully");
    } catch (err) {
      Alert.alert("Refresh Failed", "Unable to refresh tokens");
    }
  };

  const formatTokenExpiry = (expiresIn?: number) => {
    if (!expiresIn) return "Unknown";
    const minutes = Math.floor(expiresIn / 60);
    const seconds = expiresIn % 60;
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button title="Retry" onPress={handleLogin} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>Welcome to Keycloak Demo</Text>
        <Text style={styles.subtitle}>Please authenticate to continue</Text>
        <Button title="Login with Keycloak" onPress={handleLogin} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication Status</Text>
        <Text style={styles.statusText}>✅ Authenticated</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Information</Text>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Name:</Text>
          <Text style={styles.infoValue}>{user?.name || "N/A"}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{user?.email || "N/A"}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Username:</Text>
          <Text style={styles.infoValue}>{user?.preferredUsername || "N/A"}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Subject:</Text>
          <Text style={styles.infoValue}>{user?.sub || "N/A"}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Email Verified:</Text>
          <Text style={styles.infoValue}>{user?.emailVerified ? "✅ Yes" : "❌ No"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Token Information</Text>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Token Type:</Text>
          <Text style={styles.infoValue}>{tokens?.tokenType || "N/A"}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Expires In:</Text>
          <Text style={styles.infoValue}>{formatTokenExpiry(tokens?.expiresIn)}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Scope:</Text>
          <Text style={styles.infoValue}>{tokens?.scope || "N/A"}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.infoLabel}>Has Refresh Token:</Text>
          <Text style={styles.infoValue}>{tokens?.refreshToken ? "✅ Yes" : "❌ No"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.buttonContainer}>
          <Button title="Refresh Tokens" onPress={handleRefresh} disabled={!tokens?.refreshToken} />
        </View>
        <View style={styles.buttonContainer}>
          <Button title="Logout" onPress={handleLogout} color="#ff4444" />
        </View>
      </View>

      {/* Debug Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Information</Text>
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Access Token (first 50 chars):{"\n"}
            {tokens?.accessToken?.substring(0, 50) || "N/A"}...
          </Text>
        </View>
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Raw User Object:{"\n"}
            {JSON.stringify(user, null, 2)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// Error Handler Component
function ErrorHandler() {
  const handleError = (error: string) => {
    console.error("Keycloak Error:", error);
    Alert.alert("Authentication Error", error);
  };

  const handleTokensChanged = (tokens: KeycloakTokens | null) => {
    if (tokens) {
      console.log("✅ User authenticated, tokens received");
    } else {
      console.log("❌ User logged out, tokens cleared");
    }
  };

  return (
    <KeycloakProvider config={keycloakConfig} onError={handleError} onTokensChanged={handleTokensChanged}>
      <AppContent />
    </KeycloakProvider>
  );
}

// Main App Export
export default function App() {
  return <ErrorHandler />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    color: "#666",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#ff4444",
    textAlign: "center",
    marginBottom: 16,
  },
  section: {
    backgroundColor: "white",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  statusText: {
    fontSize: 16,
    color: "#00aa00",
    fontWeight: "500",
  },
  infoContainer: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  buttonContainer: {
    marginBottom: 12,
  },
  debugContainer: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#333",
  },
});

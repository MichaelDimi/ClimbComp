import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import TopStatusBar from "./components/TopStatusBar";
import AuthScreen from "./screens/AuthScreen";
import MainApp from "./screens/MainApp";

const AuthGate: React.FC = () => {
  const { user } = useAuth();
  return user ? <MainApp /> : <AuthScreen />;
};

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.appContainer}>
        <StatusBar style="auto" />
        <TopStatusBar />
        <AuthGate />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
});

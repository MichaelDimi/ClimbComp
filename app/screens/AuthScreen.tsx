import React, { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";

const AuthScreen: React.FC = () => {
    const { login, register, authLoading, authError } = useAuth();

    const [mode, setMode] = useState<"login" | "register">("login");
    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const onSubmit = async () => {
        if (mode === "login") {
            await login(email.trim(), password);
        } else {
            await register(displayName.trim(), email.trim(), password);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.centered}>
            <View style={styles.card}>
                <Text style={styles.appTitle}>ClimbComp</Text>
                <Text style={styles.cardTitle}>
                    {mode === "login" ? "Log in" : "Create an account"}
                </Text>

                {mode === "register" && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Display name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Alice Admin"
                            value={displayName}
                            autoCapitalize="words"
                            onChangeText={setDisplayName}
                            placeholderTextColor="#ccc"
                        />
                    </View>
                )}

                <View style={styles.field}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="you@example.com"
                        value={email}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        onChangeText={setEmail}
                        placeholderTextColor="#ccc"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                        placeholderTextColor="#ccc"
                    />
                </View>

                {authError ? (
                    <Text style={styles.errorText}>{authError}</Text>
                ) : null}

                <TouchableOpacity
                    style={[styles.button, authLoading && styles.buttonDisabled]}
                    onPress={onSubmit}
                    disabled={authLoading}
                >
                    {authLoading ? (
                        <ActivityIndicator />
                    ) : (
                        <Text style={styles.buttonLabel}>
                            {mode === "login" ? "Log in" : "Register"}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.switchMode}
                    onPress={() =>
                        setMode((m) => (m === "login" ? "register" : "login"))
                    }
                >
                    <Text style={styles.switchModeText}>
                        {mode === "login"
                            ? "Need an account? Register"
                            : "Already have an account? Log in"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    centered: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
    },
    card: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#ffffff",
        padding: 20,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    appTitle: {
        fontSize: 24,
        fontWeight: "800",
        textAlign: "center",
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 16,
        textAlign: "center",
    },
    field: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        marginBottom: 4,
        color: "#4b5563",
    },
    input: {
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        backgroundColor: "#f9fafb",
    },
    errorText: {
        color: "#b91c1c",
        marginBottom: 8,
        fontSize: 13,
    },
    button: {
        marginTop: 8,
        backgroundColor: "#2563eb",
        paddingVertical: 10,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonLabel: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 15,
    },
    switchMode: {
        marginTop: 12,
        alignItems: "center",
    },
    switchModeText: {
        fontSize: 13,
        color: "#4b5563",
    },
});

export default AuthScreen;

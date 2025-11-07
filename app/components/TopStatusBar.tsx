import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { API_BASE } from "../config";

const TopStatusBar: React.FC = () => {
    const { user } = useAuth();
    const [apiStatus, setApiStatus] = useState("Checking API…");

    useEffect(() => {
        let cancelled = false;

        fetch(`${API_BASE}/api/health`)
            .then((r) => r.json())
            .then(() => {
                if (!cancelled) setApiStatus("API: OK");
            })
            .catch(() => {
                if (!cancelled) setApiStatus("API: unreachable");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <View style={styles.statusBar}>
            <Text style={styles.statusText}>{apiStatus}</Text>
            {user ? (
                <Text style={styles.statusText}>
                    Logged in as <Text style={styles.bold}>{user.display_name}</Text>
                </Text>
            ) : (
                <Text style={styles.statusText}>Not logged in</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    statusBar: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#111827",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    statusText: {
        color: "#e5e7eb",
        fontSize: 12,
    },
    bold: {
        fontWeight: "700",
    },
});

export default TopStatusBar;

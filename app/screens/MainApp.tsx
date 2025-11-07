import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import HomeScreen from "./HomeScreen";
import CompetitionFormScreen from "./CompetitionFormScreen";
import CompetitionDetailScreen from "./CompetitionDetailScreen";
import { Competition } from "../types";

type Screen = "home" | "createCompetition" | "competitionDetail";

const MainApp: React.FC = () => {
    const { user, logout } = useAuth();
    const [screen, setScreen] = useState<Screen>("home");
    const [selectedCompetition, setSelectedCompetition] =
        useState<Competition | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleCreated = (comp: Competition) => {
        setScreen("home");
        setRefreshKey((k) => k + 1);
        setSelectedCompetition(comp); // for future use if needed
    };

    const handleLogout = () => {
        logout();
        setScreen("home");
        setSelectedCompetition(null);
    };

    return (
        <View style={styles.mainContainer}>
            <View style={styles.navBar}>
                <Text style={styles.navTitle}>ClimbComp</Text>
                <View style={styles.navRight}>
                    <Text style={styles.navUser}>
                        {user ? `Hi, ${user.display_name}` : ""}
                    </Text>
                    <TouchableOpacity onPress={handleLogout}>
                        <Text style={styles.navLink}>Log out</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainContent}>
                {screen === "home" && (
                    <HomeScreen
                        refreshKey={refreshKey}
                        onCreateCompetition={() => setScreen("createCompetition")}
                        onSelectCompetition={(comp) => {
                            setSelectedCompetition(comp);
                            setScreen("competitionDetail");
                        }}
                    />
                )}

                {screen === "createCompetition" && (
                    <CompetitionFormScreen
                        mode="create"
                        onCancel={() => setScreen("home")}
                        onSaved={handleCreated}
                    />
                )}

                {screen === "competitionDetail" && selectedCompetition && (
                    <CompetitionDetailScreen
                        competition={selectedCompetition}
                        onBack={() => setScreen("home")}
                        onDeleted={() => {
                            setSelectedCompetition(null);
                            setScreen("home");
                            setRefreshKey((k) => k + 1);
                        }}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
    },
    navBar: {
        height: 56,
        paddingHorizontal: 16,
        backgroundColor: "#111827",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    navTitle: {
        color: "#f9fafb",
        fontSize: 18,
        fontWeight: "700",
    },
    navRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    navUser: {
        color: "#e5e7eb",
        marginRight: 16,
        fontSize: 14,
    },
    navLink: {
        color: "#93c5fd",
        fontSize: 14,
        fontWeight: "600",
    },
    mainContent: {
        flex: 1,
        padding: 16,
    },
});

export default MainApp;
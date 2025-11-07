import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { Competition } from "../types";
import { fetchCompetitions } from "../api";

type Props = {
    refreshKey: number;
    onCreateCompetition: () => void;
    onSelectCompetition: (competition: Competition) => void;
};

const PLACEHOLDER_COLOR = "rgba(148, 163, 184, 0.6)";

const HomeScreen: React.FC<Props> = ({
    refreshKey,
    onCreateCompetition,
    onSelectCompetition,
}) => {
    const { user, token } = useAuth();
    const [search, setSearch] = useState("");
    const [showMine, setShowMine] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [competitions, setCompetitions] = useState<Competition[]>([]);

    const loadCompetitions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCompetitions(search, token ?? undefined);
            setCompetitions(data);
        } catch (err: any) {
            console.error("Failed to load competitions", err);
            setError(err.message || "Failed to load competitions");
        } finally {
            setLoading(false);
        }
    }, [search, token]);

    useEffect(() => {
        loadCompetitions();
    }, [loadCompetitions, refreshKey]);

    const visibleCompetitions =
        showMine && user
            ? competitions.filter((c) => c.created_by === user.id)
            : competitions;

    return (
        <View style={styles.container}>
            <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Competitions</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={onCreateCompetition}>
                    <Text style={styles.primaryButtonLabel}>Create competition</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filters}>
                <View style={styles.searchRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Search by name..."
                        placeholderTextColor={PLACEHOLDER_COLOR}
                        value={search}
                        onChangeText={setSearch}
                    />
                    <TouchableOpacity
                        style={styles.smallButton}
                        onPress={loadCompetitions}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator />
                        ) : (
                            <Text style={styles.smallButtonLabel}>Search</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.toggleRow}>
                    <Switch value={showMine} onValueChange={setShowMine} />
                    <Text style={styles.toggleLabel}>Show only my competitions</Text>
                </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {loading && visibleCompetitions.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator />
                </View>
            ) : visibleCompetitions.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.mutedText}>No competitions found.</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={{ paddingBottom: 16 }}
                >
                    {visibleCompetitions.map((c) => (
                        <TouchableOpacity
                            key={c.id}
                            style={styles.card}
                            onPress={() => onSelectCompetition(c)}
                        >
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{c.title}</Text>

                                <View style={styles.badgeRow}>
                                    {user && c.created_by === user.id && (
                                        <Text style={styles.badge}>Organizer</Text>
                                    )}
                                    {!c.is_public && (
                                        <Text style={[styles.badge, styles.badgePrivate]}>
                                            Private
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {c.description ? (
                                <Text numberOfLines={2} style={styles.cardDescription}>
                                    {c.description}
                                </Text>
                            ) : null}

                            <View style={styles.metaRow}>
                                {c.venue_name ? (
                                    <Text style={styles.metaText}>{c.venue_name}</Text>
                                ) : (
                                    <View />
                                )}
                                {c.starts_at ? (
                                    <Text style={styles.metaText}>
                                        {new Date(c.starts_at).toLocaleDateString()}
                                    </Text>
                                ) : null}
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    rowBetween: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "700",
    },
    primaryButton: {
        backgroundColor: "#2563eb",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
    },
    primaryButtonLabel: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 14,
    },
    filters: { marginBottom: 8 },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        backgroundColor: "#f9fafb",
        marginRight: 8,
    },
    smallButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#e5e7eb",
        alignItems: "center",
        justifyContent: "center",
    },
    smallButtonLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#111827",
    },
    toggleRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    toggleLabel: {
        marginLeft: 8,
        fontSize: 13,
        color: "#4b5563",
    },
    errorText: {
        color: "#b91c1c",
        marginBottom: 8,
    },
    centered: {
        paddingTop: 24,
        alignItems: "center",
    },
    mutedText: {
        fontSize: 13,
        color: "#9ca3af",
    },
    list: { marginTop: 8 },
    card: {
        backgroundColor: "#ffffff",
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        flexShrink: 1,
        marginRight: 8,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4, // RN 0.71+; if this errors, remove and just use marginLeft
    },
    badge: {
        fontSize: 11,
        fontWeight: "700",
        color: "#2563eb",
        backgroundColor: "#dbeafe",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        marginLeft: 4,
    },
    badgePrivate: {
        backgroundColor: "#fee2e2",
        color: "#b91c1c",
    },
    cardDescription: {
        fontSize: 13,
        color: "#4b5563",
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    metaText: {
        fontSize: 12,
        color: "#6b7280",
    },
});


export default HomeScreen;

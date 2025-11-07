import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    Competition,
    Division,
    CompetitionReport,
    CompetitionReportDivision,
    CompetitionReportStanding,
} from "../types";
import { fetchCompetitionReport } from "../api";

type Props = {
    competition: Competition;
    divisions: Division[]; // for filter chips
};

const CompetitionReportTab: React.FC<Props> = ({ competition, divisions }) => {
    const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(
        null
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<CompetitionReport | null>(null);

    const loadReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCompetitionReport(
                competition.id,
                selectedDivisionId ?? undefined
            );
            setReport(data);
        } catch (err: any) {
            console.error("Failed to load report", err);
            setError(err.message || "Failed to load report");
        } finally {
            setLoading(false);
        }
    }, [competition.id, selectedDivisionId]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const makeIfscScore = (s: CompetitionReportStanding) => {
        // IFSC-style: Tops, Zones, then attempts (no single numeric score)
        return `${s.total_tops}T ${s.total_zones}Z  (TA: ${s.total_top_attempts}, ZA: ${s.total_zone_attempts})`;
    };

    const renderDivision = (d: CompetitionReportDivision) => {
        return (
            <View key={d.division_id} style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.divisionTitle}>{d.division_name}</Text>
                    <Text style={styles.divisionMeta}>
                        {d.participant_count} competitors · {d.problem_count} problems
                    </Text>
                    <Text style={styles.divisionMeta}>
                        Total tops {d.total_tops} · total zones {d.total_zones}
                    </Text>
                </View>

                {d.podium.length === 0 ? (
                    <Text style={styles.muted}>No results yet.</Text>
                ) : (
                    <View>
                        <Text style={styles.sectionLabel}>Podium</Text>
                        {d.podium.map((s) => (
                            <View key={s.user_id} style={styles.row}>
                                <Text style={styles.rank}>{s.rank}.</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{s.user_display_name}</Text>
                                    <Text style={styles.scoreText}>{makeIfscScore(s)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    const currentDivisions = report?.divisions ?? [];

    return (
        <View style={styles.container}>
            {/* Division filter chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={{ paddingRight: 8 }}
            >
                <TouchableOpacity
                    style={[
                        styles.chip,
                        selectedDivisionId === null && styles.chipSelected,
                    ]}
                    onPress={() => setSelectedDivisionId(null)}
                >
                    <Text
                        style={[
                            styles.chipLabel,
                            selectedDivisionId === null && styles.chipLabelSelected,
                        ]}
                    >
                        All divisions
                    </Text>
                </TouchableOpacity>
                {divisions.map((d) => {
                    const selected = selectedDivisionId === d.id;
                    return (
                        <TouchableOpacity
                            key={d.id}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() =>
                                setSelectedDivisionId((prev) => (prev === d.id ? null : d.id))
                            }
                        >
                            <Text
                                style={[
                                    styles.chipLabel,
                                    selected && styles.chipLabelSelected,
                                ]}
                            >
                                {d.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading && !report ? (
                <View style={styles.centered}>
                    <ActivityIndicator />
                </View>
            ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : currentDivisions.length === 0 ? (
                <Text style={styles.muted}>No divisions/results yet.</Text>
            ) : (
                <ScrollView
                    style={{ marginTop: 8 }}
                    contentContainerStyle={{ paddingBottom: 16 }}
                >
                    {currentDivisions.map(renderDivision)}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
    },
    filterRow: {
        marginBottom: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d1d5db",
        marginRight: 6,
        backgroundColor: "#f9fafb",
    },
    chipSelected: {
        backgroundColor: "#2563eb",
        borderColor: "#2563eb",
    },
    chipLabel: {
        fontSize: 12,
        color: "#374151",
    },
    chipLabelSelected: {
        color: "#ffffff",
        fontWeight: "600",
    },
    centered: {
        paddingVertical: 12,
        alignItems: "center",
    },
    errorText: {
        color: "#b91c1c",
    },
    muted: {
        color: "#9ca3af",
        fontSize: 13,
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 8,
    },
    divisionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 2,
    },
    divisionMeta: {
        fontSize: 12,
        color: "#6b7280",
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 4,
        marginTop: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 4,
    },
    rank: {
        width: 20,
        fontWeight: "700",
        fontSize: 13,
    },
    name: {
        fontSize: 13,
        fontWeight: "500",
        color: "#111827",
    },
    scoreText: {
        fontSize: 12,
        color: "#4b5563",
    },
});

export default CompetitionReportTab;
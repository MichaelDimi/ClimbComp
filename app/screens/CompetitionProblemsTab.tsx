import React, { useCallback, useEffect, useState } from "react";
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
import {
    Competition,
    CompetitionParticipant,
    Division,
    ProblemWithMyAscent,
    Ascent,
} from "../types";
import {
    fetchProblemsForCompetition,
    createProblem,
    deleteProblem,
    saveMyAscent,
} from "../api";


type Props = {
    competition: Competition;
    divisions: Division[];
    myParticipant: CompetitionParticipant | null;
    isOrganizer: boolean;
    editingDetails: boolean;
};

type AscentState = {
    topped: boolean;
    top_attempts: string; // string for input
    zone: boolean;
    zone_attempts: string;
    saving: boolean;
    error: string | null;
};

const defaultAscentState: AscentState = {
    topped: false,
    top_attempts: "",
    zone: false,
    zone_attempts: "",
    saving: false,
    error: null,
};

const PLACEHOLDER_COLOR = "rgba(148, 163, 184, 0.6)";

const CompetitionProblemsTab: React.FC<Props> = ({
    competition,
    divisions,
    myParticipant,
    isOrganizer,
    editingDetails,
}) => {
    const { token } = useAuth();

    const [problems, setProblems] = useState<ProblemWithMyAscent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // new problem form
    const [newCode, setNewCode] = useState("");
    const [newGrade, setNewGrade] = useState("");
    const [newDiscipline, setNewDiscipline] = useState("boulder");
    const [newDivisionId, setNewDivisionId] = useState<string | null>(null);
    const [creatingProblem, setCreatingProblem] = useState(false);

    // ascents keyed by problem id (only in UI)
    const [ascents, setAscents] = useState<Record<string, AscentState>>({});

    const canLogAscents = !!token && !!myParticipant && !editingDetails;
    const canManageProblems = isOrganizer;

    // Seed ascents from the backend my_ascent field
    const seedAscentsFromProblems = (rows: ProblemWithMyAscent[]) => {
        const initial: Record<string, AscentState> = {};
        rows.forEach((p) => {
            const a: Ascent | null | undefined = p.my_ascent;
            initial[p.id] = {
                topped: a?.topped ?? false,
                top_attempts:
                    a?.top_attempts === null || a?.top_attempts === undefined
                        ? ""
                        : String(a.top_attempts),
                zone: a?.zone ?? false,
                zone_attempts:
                    a?.zone_attempts === null || a?.zone_attempts === undefined
                        ? ""
                        : String(a.zone_attempts),
                saving: false,
                error: null,
            };
        });
        setAscents(initial);
    };

    // ---------- load problems (no ascents prefill) ----------

    const loadProblems = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const rows = await fetchProblemsForCompetition(
                competition.id,
                token ?? undefined
            );
            setProblems(rows);
            seedAscentsFromProblems(rows);
        } catch (err: any) {
            console.error("Failed to load problems", err);
            setError(err.message || "Failed to load problems");
        } finally {
            setLoading(false);
        }
    }, [competition.id, token]);

    useEffect(() => {
        loadProblems();
    }, [loadProblems]);

    // ---------- Problem management (organizer) ----------

    const handleAddProblem = async () => {
        if (!token) {
            setError("You must be logged in.");
            return;
        }
        if (!canManageProblems) {
            setError("Only the organizer can add problems.");
            return;
        }
        if (!newCode.trim()) {
            setError("Problem code is required.");
            return;
        }

        setCreatingProblem(true);
        setError(null);
        try {
            const created = await createProblem(
                competition.id,
                {
                    code: newCode.trim(),
                    division_id: newDivisionId ?? null,
                    grade: newGrade.trim() || null,
                    discipline: newDiscipline || "boulder",
                },
                token
            );

            const newProblem: ProblemWithMyAscent = {
                ...created,
                division_name:
                    divisions.find((d) => d.id === created.division_id)?.name ?? null,
                my_ascent: null, // we aren't using this now
            };

            setProblems((prev) => [...prev, newProblem]);
            setNewCode("");
            setNewGrade("");
            setNewDivisionId(null);
            setNewDiscipline("boulder");
        } catch (err: any) {
            console.error("Failed to create problem", err);
            setError(err.message || "Failed to create problem");
        } finally {
            setCreatingProblem(false);
        }
    };

    const handleDeleteProblem = async (problemId: string) => {
        if (!token) {
            setError("You must be logged in.");
            return;
        }
        if (!canManageProblems) {
            setError("Only the organizer can delete problems.");
            return;
        }

        // optimistic UI
        const prevProblems = problems;
        setProblems((p) => p.filter((pr) => pr.id !== problemId));

        try {
            await deleteProblem(problemId, token);
            // also remove any local ascent state
            setAscents((prev) => {
                const copy = { ...prev };
                delete copy[problemId];
                return copy;
            });
        } catch (err: any) {
            console.error("Failed to delete problem", err);
            setError(err.message || "Failed to delete problem");
            setProblems(prevProblems); // revert
        }
    };

    // ---------- Ascents (for current user, explicit Save) ----------

    const ensureAscentState = (problemId: string): AscentState => {
        return ascents[problemId] ?? defaultAscentState;
    };

    const handleToggleTop = (problemId: string) => {
        if (!canLogAscents) return;

        setAscents((prev) => {
            const prevState = prev[problemId] ?? defaultAscentState;
            const nextTopped = !prevState.topped;
            const nextState: AscentState = {
                ...prevState,
                topped: nextTopped,
                // if top is turned on, also set zone true
                zone: nextTopped ? true : prevState.zone,
            };
            return { ...prev, [problemId]: nextState };
        });
    };

    const handleToggleZone = (problemId: string) => {
        if (!canLogAscents) return;

        setAscents((prev) => {
            const prevState = prev[problemId] ?? defaultAscentState;
            const nextState: AscentState = {
                ...prevState,
                zone: !prevState.zone,
            };
            return { ...prev, [problemId]: nextState };
        });
    };

    const handleChangeAttempts = (
        problemId: string,
        field: "top_attempts" | "zone_attempts",
        value: string
    ) => {
        if (!canLogAscents) return;

        // Only allow digits or empty string
        if (value !== "" && !/^\d+$/.test(value)) return;

        setAscents((prev) => {
            const prevState = prev[problemId] ?? defaultAscentState;
            const nextState: AscentState = {
                ...prevState,
                [field]: value,
            };
            return { ...prev, [problemId]: nextState };
        });
    };

    const handleSaveAscent = async (problemId: string) => {
        if (!token || !myParticipant) {
            setError("You must be logged in and joined to log ascents.");
            return;
        }

        const state = ensureAscentState(problemId);

        const payload = {
            topped: state.topped,
            top_attempts:
                state.top_attempts === "" ? null : Number(state.top_attempts),
            zone: state.zone,
            zone_attempts:
                state.zone_attempts === "" ? null : Number(state.zone_attempts),
        };

        // mark saving for that problem
        setAscents((prev) => ({
            ...prev,
            [problemId]: { ...state, saving: true, error: null },
        }));

        try {
            await saveMyAscent(problemId, payload, token);

            setAscents((prev) => {
                const cur = prev[problemId] ?? state;
                return {
                    ...prev,
                    [problemId]: { ...cur, saving: false, error: null },
                };
            });
        } catch (err: any) {
            console.error("Failed to save ascent", err);
            setAscents((prev) => {
                const cur = prev[problemId] ?? state;
                return {
                    ...prev,
                    [problemId]: {
                        ...cur,
                        saving: false,
                        error: err.message || "Failed to save ascent",
                    },
                };
            });
        }
    };

    // ---------- Rendering ----------

    const renderAddProblemCard = () => {
        if (!canManageProblems) return null;

        return (
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add problem</Text>

                <View style={styles.fieldRow}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Code *</Text>
                        <TextInput
                            style={styles.input}
                            value={newCode}
                            onChangeText={setNewCode}
                            placeholder="B1, #12, P-01"
                            placeholderTextColor={PLACEHOLDER_COLOR}
                        />
                    </View>

                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Grade</Text>
                        <TextInput
                            style={styles.input}
                            value={newGrade}
                            onChangeText={setNewGrade}
                            placeholder="V5, 5.11b, etc."
                            placeholderTextColor={PLACEHOLDER_COLOR}
                        />
                    </View>
                </View>

                <View style={styles.fieldRow}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Discipline</Text>
                        <TextInput
                            style={styles.input}
                            value={newDiscipline}
                            onChangeText={setNewDiscipline}
                            placeholder="boulder, lead,..."
                            placeholderTextColor={PLACEHOLDER_COLOR}
                        />
                    </View>

                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Division</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.divisionChipRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.divisionChip,
                                        newDivisionId === null && styles.divisionChipSelected,
                                    ]}
                                    onPress={() => setNewDivisionId(null)}
                                >
                                    <Text
                                        style={[
                                            styles.divisionChipLabel,
                                            newDivisionId === null &&
                                            styles.divisionChipLabelSelected,
                                        ]}
                                    >
                                        Unassigned
                                    </Text>
                                </TouchableOpacity>
                                {divisions.map((d) => {
                                    const selected = newDivisionId === d.id;
                                    return (
                                        <TouchableOpacity
                                            key={d.id}
                                            style={[
                                                styles.divisionChip,
                                                selected && styles.divisionChipSelected,
                                            ]}
                                            onPress={() => setNewDivisionId(d.id)}
                                        >
                                            <Text
                                                style={[
                                                    styles.divisionChipLabel,
                                                    selected && styles.divisionChipLabelSelected,
                                                ]}
                                            >
                                                {d.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.addButton, creatingProblem && styles.addButtonDisabled]}
                    onPress={handleAddProblem}
                    disabled={creatingProblem}
                >
                    {creatingProblem ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.addButtonLabel}>Add problem</Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderProblemRow = (p: ProblemWithMyAscent) => {
        const state = ensureAscentState(p.id);

        return (
            <View key={p.id} style={styles.problemCard}>
                <View style={styles.problemHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.problemCode}>{p.code}</Text>
                        <View style={styles.problemMetaRow}>
                            {p.division_name && (
                                <Text style={[styles.badge, styles.badgePurple]}>
                                    {p.division_name}
                                </Text>
                            )}
                            {p.grade && (
                                <Text style={[styles.badge, styles.badgeGray]}>{p.grade}</Text>
                            )}
                            {p.discipline && (
                                <Text style={[styles.badge, styles.badgeBlue]}>
                                    {p.discipline}
                                </Text>
                            )}
                        </View>
                    </View>

                    {canManageProblems && (
                        <TouchableOpacity
                            onPress={() => handleDeleteProblem(p.id)}
                            style={styles.deleteProblemButton}
                        >
                            <Text style={styles.deleteProblemText}>×</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {canLogAscents && (
                    <View style={styles.ascentRow}>
                        <View style={styles.ascentColumn}>
                            <View style={styles.ascentToggleRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.checkbox,
                                        state.topped && styles.checkboxChecked,
                                    ]}
                                    onPress={() => handleToggleTop(p.id)}
                                >
                                    {state.topped && <Text style={styles.checkboxMark}>✓</Text>}
                                </TouchableOpacity>
                                <Text style={styles.ascentLabel}>Top</Text>
                            </View>
                            <View style={styles.attemptRow}>
                                <Text style={styles.attemptLabel}>Attempts</Text>
                                <TextInput
                                    style={styles.attemptInput}
                                    keyboardType="numeric"
                                    value={state.top_attempts}
                                    onChangeText={(v) =>
                                        handleChangeAttempts(p.id, "top_attempts", v)
                                    }
                                    placeholder="0"
                                    placeholderTextColor={PLACEHOLDER_COLOR}
                                />
                            </View>
                        </View>

                        <View style={styles.ascentColumn}>
                            <View style={styles.ascentToggleRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.checkbox,
                                        state.zone && styles.checkboxChecked,
                                    ]}
                                    onPress={() => handleToggleZone(p.id)}
                                >
                                    {state.zone && <Text style={styles.checkboxMark}>✓</Text>}
                                </TouchableOpacity>
                                <Text style={styles.ascentLabel}>Zone</Text>
                            </View>
                            <View style={styles.attemptRow}>
                                <Text style={styles.attemptLabel}>Attempts</Text>
                                <TextInput
                                    style={styles.attemptInput}
                                    keyboardType="numeric"
                                    value={state.zone_attempts}
                                    onChangeText={(v) =>
                                        handleChangeAttempts(p.id, "zone_attempts", v)
                                    }
                                    placeholder="0"
                                    placeholderTextColor={PLACEHOLDER_COLOR}
                                />
                            </View>
                        </View>

                        <View style={styles.ascentStatusColumn}>
                            <TouchableOpacity
                                style={[
                                    styles.saveButton,
                                    (state.saving || !canLogAscents) && styles.saveButtonDisabled,
                                ]}
                                onPress={() => handleSaveAscent(p.id)}
                                disabled={state.saving || !canLogAscents}
                            >
                                {state.saving ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.saveButtonLabel}>Save</Text>
                                )}
                            </TouchableOpacity>
                            {state.error && (
                                <Text style={styles.ascentError}>{state.error}</Text>
                            )}
                        </View>
                    </View>
                )}

                {!canLogAscents && (
                    <Text style={styles.mutedSmall}>
                        Join this competition to log ascents for this problem.
                    </Text>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {renderAddProblemCard()}

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Problems</Text>

                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator />
                    </View>
                ) : error ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : problems.length === 0 ? (
                    <Text style={styles.muted}>No problems have been added yet.</Text>
                ) : (
                    problems.map(renderProblemRow)
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.03,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
    },
    fieldRow: {
        flexDirection: "row",
        marginBottom: 8,
    },
    field: {
        marginBottom: 8,
    },
    label: {
        fontSize: 13,
        color: "#6b7280",
        marginBottom: 4,
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
    divisionChipRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 4,
    },
    divisionChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d1d5db",
        marginRight: 6,
    },
    divisionChipSelected: {
        backgroundColor: "#2563eb",
        borderColor: "#2563eb",
    },
    divisionChipLabel: {
        fontSize: 12,
        color: "#374151",
    },
    divisionChipLabelSelected: {
        color: "#ffffff",
    },
    addButton: {
        alignSelf: "flex-start",
        marginTop: 4,
        backgroundColor: "#2563eb",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
    },
    addButtonDisabled: {
        backgroundColor: "#9ca3af",
    },
    addButtonLabel: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 14,
    },
    centered: {
        paddingVertical: 12,
        alignItems: "center",
    },
    errorText: {
        color: "#b91c1c",
        marginTop: 4,
    },
    muted: {
        fontSize: 13,
        color: "#9ca3af",
    },
    mutedSmall: {
        marginTop: 8,
        fontSize: 11,
        color: "#6b7280",
    },
    problemCard: {
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
        paddingTop: 8,
        marginTop: 8,
    },
    problemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    problemCode: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 2,
    },
    problemMetaRow: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    badge: {
        fontSize: 11,
        fontWeight: "600",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        marginRight: 6,
        marginBottom: 4,
    },
    badgeBlue: {
        backgroundColor: "#dbeafe",
        color: "#1d4ed8",
    },
    badgePurple: {
        backgroundColor: "#ede9fe",
        color: "#5b21b6",
    },
    badgeGray: {
        backgroundColor: "#e5e7eb",
        color: "#374151",
    },
    deleteProblemButton: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
    },
    deleteProblemText: {
        fontSize: 18,
        fontWeight: "700",
        color: "#b91c1c",
    },
    ascentRow: {
        flexDirection: "row",
        marginTop: 6,
    },
    ascentColumn: {
        flex: 1,
        marginRight: 8,
    },
    ascentToggleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#d1d5db",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 6,
        backgroundColor: "#ffffff",
    },
    checkboxChecked: {
        backgroundColor: "#2563eb",
        borderColor: "#2563eb",
    },
    checkboxMark: {
        color: "#ffffff",
        fontSize: 12,
        fontWeight: "700",
    },
    ascentLabel: {
        fontSize: 13,
        color: "#111827",
    },
    attemptRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 2,
    },
    attemptLabel: {
        fontSize: 12,
        color: "#6b7280",
        marginRight: 4,
    },
    attemptInput: {
        width: 50,
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 4,
        fontSize: 13,
        backgroundColor: "#f9fafb",
    },
    ascentStatusColumn: {
        justifyContent: "flex-start",
        alignItems: "flex-end",
    },
    saveButton: {
        backgroundColor: "#16a34a",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    saveButtonDisabled: {
        backgroundColor: "#9ca3af",
    },
    saveButtonLabel: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 12,
    },
    ascentError: {
        fontSize: 11,
        color: "#b91c1c",
        maxWidth: 160,
        marginTop: 4,
    },
});

export default CompetitionProblemsTab;

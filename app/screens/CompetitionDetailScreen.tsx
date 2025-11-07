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
import {
    Competition,
    Division,
    CompetitionParticipant,
} from "../types";
import {
    fetchCompetitionById,
    fetchDivisions,
    fetchCompetitionParticipants,
    joinCompetition,
    updateCompetition,
    deleteCompetition,
    createDivision,
    deleteDivision as deleteDivisionApi,
} from "../api";
import CompetitionProblemsTab from "./CompetitionProblemsTab";
import CompetitionReportTab from "./CompetitionReportTab";

type Props = {
    competition: Competition;
    onBack: () => void;
    onDeleted: () => void;
};

const CompetitionDetailScreen: React.FC<Props> = ({
    competition,
    onBack,
    onDeleted,
}) => {
    const { user, token } = useAuth();

    const [comp, setComp] = useState<Competition>(competition);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [myParticipant, setMyParticipant] =
        useState<CompetitionParticipant | null>(null);
    const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(
        null
    );

    const [loading, setLoading] = useState(true);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    // Editing details state
    const [editingDetails, setEditingDetails] = useState(false);
    const [editTitle, setEditTitle] = useState(comp.title);
    const [editDescription, setEditDescription] = useState(
        comp.description ?? ""
    );
    const [editIsPublic, setEditIsPublic] = useState(comp.is_public);
    const [savingDetails, setSavingDetails] = useState(false);

    // Delete competition state
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Manage divisions state
    const [newDivisionName, setNewDivisionName] = useState("");
    const [savingDivision, setSavingDivision] = useState(false);
    const [deletingDivisionId, setDeletingDivisionId] = useState<string | null>(
        null
    );

    // Tab management

    type TabKey = "details" | "problems" | "report";
    const [activeTab, setActiveTab] = useState<TabKey>("details");

    const loadData = useCallback(async () => {
        setLoading(true);
        setJoinError(null);
        try {
            const [freshComp, divs, parts] = await Promise.all([
                fetchCompetitionById(competition.id, token ?? undefined),
                fetchDivisions(competition.id, token ?? undefined),
                user
                    ? fetchCompetitionParticipants(competition.id, token ?? undefined)
                    : Promise.resolve([] as CompetitionParticipant[]),
            ]);

            setComp(freshComp);
            setDivisions(divs);

            if (user) {
                const mine =
                    (parts as CompetitionParticipant[]).find(
                        (p) => p.user_id === user.id
                    ) ?? null;
                setMyParticipant(mine);
                setSelectedDivisionId(mine?.division_id ?? null);
            } else {
                setMyParticipant(null);
                setSelectedDivisionId(null);
            }
        } catch (err: any) {
            console.error("Failed to load competition", err);
            setJoinError(err.message || "Failed to load competition");
        } finally {
            setLoading(false);
        }
    }, [competition.id, token, user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Keep edit fields in sync when competition changes (e.g., after update)
    useEffect(() => {
        setEditTitle(comp.title);
        setEditDescription(comp.description ?? "");
        setEditIsPublic(comp.is_public);
    }, [comp.id, comp.title, comp.description, comp.is_public]);

    // Default division (prefer "Beginner", otherwise first)
    useEffect(() => {
        if (myParticipant) return; // already registered
        if (selectedDivisionId) return; // already chosen
        if (divisions.length === 0) return;

        const beginner = divisions.find((d) =>
            d.name.toLowerCase().includes("begin")
        );
        const defaultDiv = beginner ?? divisions[0];
        setSelectedDivisionId(defaultDiv.id);
    }, [myParticipant, divisions, selectedDivisionId]);

    const registrationClosed = comp.starts_at
        ? new Date(comp.starts_at) <= new Date()
        : false;

    const isOrganizer = user && comp.created_by === user.id;
    const isPrivate = !comp.is_public;

    const handleJoin = async () => {
        if (!user || !token) {
            setJoinError("You must be logged in to join.");
            return;
        }
        if (registrationClosed) {
            setJoinError("Registration is closed for this competition.");
            return;
        }
        if (divisions.length > 0 && !selectedDivisionId) {
            setJoinError("Please select a division.");
            return;
        }

        setJoining(true);
        setJoinError(null);
        try {
            const participant = await joinCompetition(
                comp.id,
                selectedDivisionId,
                token
            );
            setMyParticipant(participant);
        } catch (err: any) {
            console.error("Failed to join competition", err);
            setJoinError(err.message || "Failed to join competition");
        } finally {
            setJoining(false);
        }
    };

    const handleStartEdit = () => {
        if (!isOrganizer) return;
        setEditingDetails(true);
        setJoinError(null);
    };

    const handleCancelEdit = () => {
        setEditingDetails(false);
        setEditTitle(comp.title);
        setEditDescription(comp.description ?? "");
        setEditIsPublic(comp.is_public);
    };

    const handleSaveDetails = async () => {
        if (!user || !token) {
            setJoinError("You must be logged in.");
            return;
        }
        if (!isOrganizer) {
            setJoinError("Only the organizer can edit this competition.");
            return;
        }
        if (!editTitle.trim()) {
            setJoinError("Title is required.");
            return;
        }

        setSavingDetails(true);
        setJoinError(null);
        try {
            const updated = await updateCompetition(
                comp.id,
                {
                    title: editTitle.trim(),
                    description: editDescription.trim() || null,
                    is_public: editIsPublic,
                },
                token
            );
            setComp(updated);
            setEditingDetails(false);
        } catch (err: any) {
            console.error("Failed to update competition", err);
            setJoinError(err.message || "Failed to update competition");
        } finally {
            setSavingDetails(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !token) {
            setJoinError("You must be logged in.");
            return;
        }
        if (!isOrganizer) {
            setJoinError("Only the organizer can delete this competition.");
            return;
        }

        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }

        setDeleting(true);
        setJoinError(null);
        try {
            await deleteCompetition(comp.id, token);
            onDeleted();
        } catch (err: any) {
            console.error("Failed to delete competition", err);
            setJoinError(err.message || "Failed to delete competition");
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const handleAddDivision = async () => {
        if (!user || !token) {
            setJoinError("You must be logged in.");
            return;
        }
        if (!isOrganizer) {
            setJoinError("Only the organizer can manage divisions.");
            return;
        }
        if (!newDivisionName.trim()) {
            setJoinError("Division name is required.");
            return;
        }

        setSavingDivision(true);
        setJoinError(null);
        try {
            const created = await createDivision(
                comp.id,
                newDivisionName.trim(),
                token
            );
            setDivisions((prev) => [...prev, created]);
            setNewDivisionName("");
        } catch (err: any) {
            console.error("Failed to create division", err);
            setJoinError(err.message || "Failed to create division");
        } finally {
            setSavingDivision(false);
        }
    };

    const handleDeleteDivision = async (divisionId: string) => {
        if (!user || !token) {
            setJoinError("You must be logged in.");
            return;
        }
        if (!isOrganizer) {
            setJoinError("Only the organizer can manage divisions.");
            return;
        }

        setDeletingDivisionId(divisionId);
        setJoinError(null);
        try {
            await deleteDivisionApi(comp.id, divisionId, token);
            setDivisions((prev) => prev.filter((d) => d.id !== divisionId));
            if (selectedDivisionId === divisionId) {
                setSelectedDivisionId(null);
            }
        } catch (err: any) {
            console.error("Failed to delete division", err);
            setJoinError(err.message || "Failed to delete division");
        } finally {
            setDeletingDivisionId(null);
        }
    };

    const joinButtonLabel = "Join competition";

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Top bar */}
            <View style={styles.topRow}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonLabel}>← Back</Text>
                </TouchableOpacity>
            </View>

            {/* Header: title + badges + organizer actions */}
            {editingDetails ? (
                <View style={styles.titleEditContainer}>
                    <TextInput
                        style={styles.titleInput}
                        value={editTitle}
                        onChangeText={setEditTitle}
                        placeholder="Competition title"
                    />
                </View>
            ) : (
                <Text style={styles.title}>{comp.title}</Text>
            )}

            <View style={styles.badgeRow}>
                {isOrganizer && (
                    <Text style={[styles.badge, styles.badgeBlue]}>Organizer</Text>
                )}
                {isPrivate && (
                    <Text style={[styles.badge, styles.badgeRed]}>Private</Text>
                )}
                {registrationClosed && (
                    <Text style={[styles.badge, styles.badgeGray]}>
                        Registration closed
                    </Text>
                )}
                {myParticipant && (
                    <>
                        <Text style={[styles.badge, styles.badgeGreen]}>
                            Registered
                        </Text>
                        {myParticipant.division_name && (
                            <Text style={[styles.badge, styles.badgePurple]}>
                                {myParticipant.division_name}
                            </Text>
                        )}
                    </>
                )}
            </View>

            {isOrganizer && (
                <View style={styles.organizerActions}>
                    {editingDetails ? (
                        <>
                            <TouchableOpacity
                                style={[styles.smallButton, styles.saveButton]}
                                onPress={handleSaveDetails}
                                disabled={savingDetails}
                            >
                                {savingDetails ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.smallButtonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.smallButton, styles.cancelButton]}
                                onPress={handleCancelEdit}
                                disabled={savingDetails}
                            >
                                <Text style={styles.smallButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            style={[styles.smallButton, styles.editButton]}
                            onPress={handleStartEdit}
                        >
                            <Text style={styles.smallButtonText}>Edit details</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.smallButton, styles.deleteButton]}
                        onPress={handleDelete}
                        disabled={deleting}
                    >
                        <Text style={styles.smallButtonText}>
                            {confirmDelete ? "Tap again to delete" : "Delete"}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "details" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("details")}
                >
                    <Text
                        style={[
                            styles.tabLabel,
                            activeTab === "details" && styles.tabLabelActive,
                        ]}
                    >
                        Details
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "problems" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("problems")}
                >
                    <Text
                        style={[
                            styles.tabLabel,
                            activeTab === "problems" && styles.tabLabelActive,
                        ]}
                    >
                        Problems
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === "report" && styles.tabButtonActive,
                    ]}
                    onPress={() => setActiveTab("report")}
                >
                    <Text
                        style={[
                            styles.tabLabel,
                            activeTab === "report" && styles.tabLabelActive,
                        ]}
                    >
                        Report
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Meta info */}
            {activeTab === "details" && (
                <>

                    <View style={styles.infoCard}>
                        {editingDetails ? (
                            <>
                                <Text style={styles.infoLabel}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.descriptionInput]}
                                    multiline
                                    value={editDescription}
                                    onChangeText={setEditDescription}
                                    placeholder="Describe the competition..."
                                />
                            </>
                        ) : comp.description ? (
                            <Text style={styles.description}>{comp.description}</Text>
                        ) : (
                            <Text style={styles.muted}>No description provided.</Text>
                        )}

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Venue</Text>
                            <Text style={styles.infoValue}>
                                {comp.venue_name ?? "Not set"}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Start</Text>
                            <Text style={styles.infoValue}>
                                {comp.starts_at
                                    ? new Date(comp.starts_at).toLocaleString()
                                    : "Not scheduled"}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>End</Text>
                            <Text style={styles.infoValue}>
                                {comp.ends_at
                                    ? new Date(comp.ends_at).toLocaleString()
                                    : "Not scheduled"}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Visibility</Text>
                            {editingDetails ? (
                                <View style={styles.visibilityEditRow}>
                                    <Switch
                                        value={editIsPublic}
                                        onValueChange={setEditIsPublic}
                                    />
                                    <Text style={styles.infoValue}>
                                        {editIsPublic ? "Public" : "Private"}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.infoValue}>
                                    {comp.is_public ? "Public" : "Private"}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Join section – only when logged in AND not yet registered AND not editing */}
                    {!editingDetails && (
                        <View style={styles.section}>
                            {!user ? (
                                <View style={styles.infoCard}>
                                    <Text style={styles.muted}>
                                        Log in to join this competition.
                                    </Text>
                                </View>
                            ) : !myParticipant ? (
                                <View style={styles.infoCard}>
                                    <Text style={styles.sectionSubtitle}>
                                        Choose a division
                                    </Text>

                                    {divisions.length === 0 ? (
                                        <Text style={styles.muted}>
                                            No divisions have been set up yet.
                                        </Text>
                                    ) : (
                                        <View style={styles.divisionList}>
                                            {divisions.map((d) => {
                                                const selected =
                                                    selectedDivisionId === d.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={d.id}
                                                        style={[
                                                            styles.divisionChip,
                                                            selected &&
                                                            styles.divisionChipSelected,
                                                        ]}
                                                        onPress={() =>
                                                            setSelectedDivisionId(d.id)
                                                        }
                                                        disabled={registrationClosed}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.divisionChipLabel,
                                                                selected &&
                                                                styles.divisionChipLabelSelected,
                                                            ]}
                                                        >
                                                            {d.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {joinError ? (
                                        <Text style={styles.errorText}>{joinError}</Text>
                                    ) : null}

                                    <TouchableOpacity
                                        style={[
                                            styles.joinButton,
                                            (registrationClosed || !user) &&
                                            styles.joinButtonDisabled,
                                        ]}
                                        onPress={handleJoin}
                                        disabled={
                                            registrationClosed ||
                                            !user ||
                                            joining ||
                                            divisions.length === 0
                                        }
                                    >
                                        {joining ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.joinButtonLabel}>
                                                {joinButtonLabel}
                                            </Text>
                                        )}
                                    </TouchableOpacity>

                                    {registrationClosed && (
                                        <Text style={styles.mutedSmall}>
                                            Registration is closed because the competition
                                            has already started.
                                        </Text>
                                    )}
                                </View>
                            ) : null}
                        </View>
                    )}

                    {/* Manage divisions (organizer only, while editing) */}
                    {isOrganizer && editingDetails && (
                        <View style={styles.section}>
                            <View style={styles.infoCard}>
                                <Text style={styles.sectionTitle}>Manage divisions</Text>

                                <TextInput
                                    style={[styles.input, { marginBottom: 8 }]}
                                    value={newDivisionName}
                                    onChangeText={setNewDivisionName}
                                    placeholder="New division name"
                                />

                                <TouchableOpacity
                                    style={[
                                        styles.smallButton,
                                        styles.editButton,
                                        { alignSelf: "flex-start", marginBottom: 8 },
                                    ]}
                                    onPress={handleAddDivision}
                                    disabled={savingDivision}
                                >
                                    {savingDivision ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.smallButtonText}>
                                            Add division
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.divisionManageList}>
                                    {divisions.length === 0 ? (
                                        <Text style={styles.mutedSmall}>
                                            No divisions yet.
                                        </Text>
                                    ) : (
                                        divisions.map((d) => (
                                            <View
                                                key={d.id}
                                                style={styles.divisionManageRow}
                                            >
                                                <Text
                                                    style={styles.divisionManageName}
                                                >
                                                    {d.name}
                                                </Text>
                                                <TouchableOpacity
                                                    style={
                                                        styles.divisionManageDeleteButton
                                                    }
                                                    onPress={() =>
                                                        handleDeleteDivision(d.id)
                                                    }
                                                    disabled={
                                                        deletingDivisionId === d.id
                                                    }
                                                >
                                                    {deletingDivisionId === d.id ? (
                                                        <ActivityIndicator color="#b91c1c" />
                                                    ) : (
                                                        <Text
                                                            style={
                                                                styles.divisionManageDeleteText
                                                            }
                                                        >
                                                            ×
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </View>
                        </View>
                    )}
                </>
            )}

            {activeTab === "problems" && (
                <CompetitionProblemsTab
                    competition={comp}
                    divisions={divisions}
                    myParticipant={myParticipant}
                    isOrganizer={!!isOrganizer}
                    editingDetails={editingDetails}
                />
            )}

            {activeTab === "report" && (
                <CompetitionReportTab
                    competition={comp}
                    divisions={divisions}
                />
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator />
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 32,
    },
    topRow: {
        flexDirection: "row",
        justifyContent: "flex-start",
        marginBottom: 8,
    },
    backButton: {
        paddingVertical: 4,
        paddingHorizontal: 0,
        borderRadius: 999,
    },
    backButtonLabel: {
        fontSize: 14,
        color: "#2563eb",
        fontWeight: "500",
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 8,
    },
    titleEditContainer: {
        marginBottom: 8,
    },
    titleInput: {
        fontSize: 20,
        fontWeight: "600",
        borderWidth: 1,
        borderColor: "#d1d5db",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: "#f9fafb",
    },
    badgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 8,
    },
    badge: {
        fontSize: 11,
        fontWeight: "700",
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
    badgeRed: {
        backgroundColor: "#fee2e2",
        color: "#b91c1c",
    },
    badgeGray: {
        backgroundColor: "#e5e7eb",
        color: "#374151",
    },
    badgeGreen: {
        backgroundColor: "#dcfce7",
        color: "#166534",
    },
    badgePurple: {
        backgroundColor: "#ede9fe",
        color: "#5b21b6",
    },
    organizerActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 8,
    },
    smallButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 4,
    },
    smallButtonText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#ffffff",
    },
    editButton: {
        backgroundColor: "#2563eb",
    },
    saveButton: {
        backgroundColor: "#16a34a",
    },
    cancelButton: {
        backgroundColor: "#6b7280",
    },
    deleteButton: {
        backgroundColor: "#b91c1c",
    },
    infoCard: {
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
    description: {
        fontSize: 14,
        color: "#111827",
        marginBottom: 8,
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
    descriptionInput: {
        minHeight: 64,
        textAlignVertical: "top",
        marginBottom: 8,
    },
    muted: {
        fontSize: 13,
        color: "#9ca3af",
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 4,
        alignItems: "center",
    },
    infoLabel: {
        fontSize: 13,
        color: "#6b7280",
    },
    infoValue: {
        fontSize: 13,
        color: "#111827",
    },
    visibilityEditRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    section: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 13,
        fontWeight: "500",
        marginTop: 0,
        marginBottom: 4,
    },
    divisionList: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 4,
    },
    divisionChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d1d5db",
        marginRight: 6,
        marginBottom: 6,
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
    joinButton: {
        marginTop: 10,
        backgroundColor: "#2563eb",
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 999,
        alignSelf: "flex-start",
        alignItems: "center",
        justifyContent: "center",
    },
    joinButtonDisabled: {
        backgroundColor: "#9ca3af",
    },
    joinButtonLabel: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 14,
    },
    errorText: {
        color: "#b91c1c",
        marginTop: 8,
    },
    mutedSmall: {
        marginTop: 4,
        fontSize: 11,
        color: "#6b7280",
    },
    loadingOverlay: {
        marginTop: 8,
    },
    divisionManageList: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 4,
    },
    divisionManageRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 6,
    },
    divisionManageName: {
        fontSize: 12,
        color: "#111827",
        marginRight: 4,
    },
    divisionManageDeleteButton: {
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 999,
    },
    divisionManageDeleteText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#b91c1c",
    },
    abRow: {
        flexDirection: "row",
        marginTop: 8,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    tabButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 8,
    },
    tabButtonActive: {
        backgroundColor: "#2563eb",
    },
    tabRow: {
        flexDirection: "row",
        marginTop: 8,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    tabLabel: {
        fontSize: 13,
        color: "#4b5563",
        fontWeight: "500",
    },
    tabLabelActive: {
        color: "#ffffff",
    },
});

export default CompetitionDetailScreen;

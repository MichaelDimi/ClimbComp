import React, { useState } from "react";
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
    createCompetition,
    CreateCompetitionInput,
    createVenue,
    fetchVenues,
} from "../api";
import { Competition, Venue } from "../types";

type Props = {
    mode: "create"; // we'll extend this to "edit" later if we want
    initial?: Partial<CreateCompetitionInput>;
    onSaved: (competition: Competition) => void;
    onCancel: () => void;
};

const PLACEHOLDER_COLOR = "rgba(148, 163, 184, 0.6)";
const todayISODate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// Combine date + time into an ISO string (UTC-ish) or undefined if both empty
function combineDateTime(dateStr: string, timeStr: string): string | undefined {
    const date = dateStr.trim();
    const time = timeStr.trim();

    if (!date && !time) return undefined;

    const dateToUse = date || todayISODate; // if user only typed time, assume today
    const timeToUse = time || "00:00";

    // very simple validation: YYYY-MM-DD and HH:MM
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToUse)) {
        throw new Error("Dates must be in YYYY-MM-DD format.");
    }
    if (!/^\d{2}:\d{2}$/.test(timeToUse)) {
        throw new Error("Times must be in HH:MM (24h) format.");
    }

    // Build ISO-like string; we’ll treat it as UTC for simplicity
    return `${dateToUse}T${timeToUse}:00Z`;
}

const CompetitionFormScreen: React.FC<Props> = ({
    mode,
    initial,
    onSaved,
    onCancel,
}) => {
    const { token } = useAuth();

    const [title, setTitle] = useState(initial?.title ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");

    // For create mode, default dates to today for nicer UX
    const [startDate, setStartDate] = useState(
        initial?.starts_at ? initial.starts_at.slice(0, 10) : todayISODate
    );
    const [startTime, setStartTime] = useState(
        initial?.starts_at ? initial.starts_at.slice(11, 16) : ""
    );
    const [endDate, setEndDate] = useState(
        initial?.ends_at ? initial.ends_at.slice(0, 10) : todayISODate
    );
    const [endTime, setEndTime] = useState(
        initial?.ends_at ? initial.ends_at.slice(11, 16) : ""
    );

    const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);

    // --- venue state ---

    // Manual venue fields (for creating a new one)
    const [venueName, setVenueName] = useState("");
    const [venueLat, setVenueLat] = useState("");
    const [venueLon, setVenueLon] = useState("");

    // Search existing venues
    const [venueSearchQuery, setVenueSearchQuery] = useState("");
    const [venueResults, setVenueResults] = useState<Venue[]>([]);
    const [venueSearchLoading, setVenueSearchLoading] = useState(false);
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runVenueSearch = async () => {
        const q = venueSearchQuery.trim();
        if (!q) {
            setVenueResults([]);
            return;
        }
        setVenueSearchLoading(true);
        try {
            const results = await fetchVenues(q);
            setVenueResults(results);
        } catch (err) {
            console.error("Failed to search venues", err);
        } finally {
            setVenueSearchLoading(false);
        }
    };

    const onSubmit = async () => {
        if (!token) {
            setError("You must be logged in.");
            return;
        }
        if (!title.trim()) {
            setError("Title is required.");
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            let starts_at: string | undefined;
            let ends_at: string | undefined;

            // Only combine if user typed something; combineDateTime will throw on bad format
            if (startDate.trim() || startTime.trim()) {
                starts_at = combineDateTime(startDate, startTime);
            }
            if (endDate.trim() || endTime.trim()) {
                ends_at = combineDateTime(endDate, endTime);
            }

            let venue_id: string | undefined;

            if (selectedVenue) {
                // Use existing venue
                venue_id = selectedVenue.id;
            } else {
                // Create new venue if any manual field is set
                const hasAnyVenueField =
                    venueName.trim() || venueLat.trim() || venueLon.trim();

                if (hasAnyVenueField) {
                    if (!venueName.trim() || !venueLat.trim() || !venueLon.trim()) {
                        throw new Error(
                            "If you set a venue, name, latitude, and longitude are all required."
                        );
                    }

                    const latNum = Number(venueLat);
                    const lonNum = Number(venueLon);

                    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
                        throw new Error("Latitude and longitude must be valid numbers.");
                    }
                    if (latNum < -90 || latNum > 90) {
                        throw new Error("Latitude must be between -90 and 90.");
                    }
                    if (lonNum < -180 || lonNum > 180) {
                        throw new Error("Longitude must be between -180 and 180.");
                    }

                    const venue = await createVenue(
                        {
                            name: venueName.trim(),
                            latitude: latNum,
                            longitude: lonNum,
                        },
                        token
                    );

                    venue_id = venue.id;
                }
            }

            const payload: CreateCompetitionInput = {
                title: title.trim(),
                description: description.trim() || undefined,
                venue_id: venue_id ?? undefined,
                starts_at,
                ends_at,
                is_public: isPublic,
            };

            const comp = await createCompetition(payload, token);
            onSaved(comp);
        } catch (err: any) {
            console.error("Failed to save competition", err);
            setError(err.message || "Failed to save competition");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>
                {mode === "create" ? "Create competition" : "Edit competition"}
            </Text>

            <View style={styles.field}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Fall Bouldering Comp"
                    placeholderTextColor={PLACEHOLDER_COLOR}
                />
            </View>

            <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.multiline]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Fun local comp..."
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    multiline
                />
            </View>

            {/* Venue section */}
            <Text style={styles.sectionLabel}>Venue (optional)</Text>
            <View style={styles.venueCard}>
                {/* Existing venue */}
                <Text style={styles.venueSectionTitle}>Use existing venue</Text>
                <Text style={styles.venueHint}>
                    Search for an existing gym or location.
                </Text>
                <View style={styles.row}>
                    <View style={[styles.flex1, { marginRight: 8 }]}>
                        <TextInput
                            style={styles.input}
                            value={venueSearchQuery}
                            onChangeText={setVenueSearchQuery}
                            placeholder="Start typing a venue name..."
                            placeholderTextColor={PLACEHOLDER_COLOR}
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.buttonSmall, styles.buttonGrey]}
                        onPress={runVenueSearch}
                        disabled={venueSearchLoading}
                    >
                        {venueSearchLoading ? (
                            <ActivityIndicator />
                        ) : (
                            <Text style={styles.buttonSmallLabel}>Search</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {selectedVenue && (
                    <View style={styles.selectedVenueBox}>
                        <Text style={styles.selectedVenueTitle}>Selected venue</Text>
                        <Text style={styles.selectedVenueName}>{selectedVenue.name}</Text>
                        <Text style={styles.selectedVenueCoords}>
                            {selectedVenue.latitude.toFixed(4)},{" "}
                            {selectedVenue.longitude.toFixed(4)}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedVenue(null);
                                setVenueSearchQuery("");
                                setVenueResults([]);
                            }}
                            style={[styles.buttonSmall, styles.buttonClearVenue]}
                        >
                            <Text style={styles.buttonSmallLabel}>Clear Selection</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!selectedVenue && venueResults.length > 0 && (
                    <View style={styles.venueResultsList}>
                        {venueResults.map((v) => (
                            <TouchableOpacity
                                key={v.id}
                                style={styles.venueResult}
                                onPress={() => {
                                    setSelectedVenue(v);
                                    // keep manual fields empty so "create" is clearly separate
                                    setVenueName("");
                                    setVenueLat("");
                                    setVenueLon("");
                                }}
                            >
                                <Text style={styles.venueResultName}>{v.name}</Text>
                                <Text style={styles.venueResultCoords}>
                                    {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Divider */}
                <View style={styles.venueDivider} />

                {/* Manual venue creation */}
                {!selectedVenue && (
                    <>
                        <Text style={styles.venueSectionTitle}>Or create a new venue</Text>
                        <Text style={styles.venueHint}>
                            Use this if you&apos;re hosting at a new location.
                        </Text>

                        <View style={styles.field}>
                            <Text style={styles.label}>Venue name</Text>
                            <TextInput
                                style={styles.input}
                                value={venueName}
                                onChangeText={setVenueName}
                                placeholder="Local Climbing Gym"
                                placeholderTextColor={PLACEHOLDER_COLOR}
                            />
                        </View>
                        <View style={styles.row}>
                            <View style={[styles.field, styles.flex1, { marginRight: 8 }]}>
                                <Text style={styles.label}>Latitude</Text>
                                <TextInput
                                    style={styles.input}
                                    value={venueLat}
                                    onChangeText={setVenueLat}
                                    keyboardType="numeric"
                                    placeholder="37.7749"
                                    placeholderTextColor={PLACEHOLDER_COLOR}
                                />
                            </View>
                            <View style={[styles.field, styles.flex1, { marginLeft: 8 }]}>
                                <Text style={styles.label}>Longitude</Text>
                                <TextInput
                                    style={styles.input}
                                    value={venueLon}
                                    onChangeText={setVenueLon}
                                    keyboardType="numeric"
                                    placeholder="-122.4194"
                                    placeholderTextColor={PLACEHOLDER_COLOR}
                                />
                            </View>
                        </View>
                    </>
                )}
            </View>

            {/* Start / End */}
            <Text style={styles.sectionLabel}>Start</Text>
            <View style={styles.row}>
                <View style={[styles.field, styles.flex1, { marginRight: 8 }]}>
                    <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                        style={styles.input}
                        value={startDate}
                        onChangeText={setStartDate}
                        placeholder={todayISODate}
                        placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                </View>
                <View style={[styles.field, styles.flex1, { marginLeft: 8 }]}>
                    <Text style={styles.label}>Time (HH:MM)</Text>
                    <TextInput
                        style={styles.input}
                        value={startTime}
                        onChangeText={setStartTime}
                        placeholder="18:00"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                </View>
            </View>

            <Text style={styles.sectionLabel}>End</Text>
            <View style={styles.row}>
                <View style={[styles.field, styles.flex1, { marginRight: 8 }]}>
                    <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                        style={styles.input}
                        value={endDate}
                        onChangeText={setEndDate}
                        placeholder={todayISODate}
                        placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                </View>
                <View style={[styles.field, styles.flex1, { marginLeft: 8 }]}>
                    <Text style={styles.label}>Time (HH:MM)</Text>
                    <TextInput
                        style={styles.input}
                        value={endTime}
                        onChangeText={setEndTime}
                        placeholder="22:00"
                        placeholderTextColor={PLACEHOLDER_COLOR}
                    />
                </View>
            </View>

            <View style={styles.switchRow}>
                <Text style={styles.label}>Public competition</Text>
                <Switch value={isPublic} onValueChange={setIsPublic} />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={onCancel}
                    disabled={submitting}
                >
                    <Text style={styles.secondaryLabel}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={onSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryLabel}>
                            {mode === "create" ? "Create" : "Save"}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: {
        fontSize: 20,
        fontWeight: "700",
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: "600",
        marginTop: 4,
        marginBottom: 4,
        color: "#111827",
    },
    field: { marginBottom: 12 },
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
    multiline: {
        minHeight: 64,
        textAlignVertical: "top",
    },
    row: {
        flexDirection: "row",
    },
    flex1: {
        flex: 1,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    errorText: {
        color: "#b91c1c",
        marginBottom: 8,
    },
    buttonRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 8,
    },
    button: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        marginLeft: 8,
    },
    primaryButton: {
        backgroundColor: "#2563eb",
    },
    primaryLabel: {
        color: "#ffffff",
        fontWeight: "600",
    },
    secondaryButton: {
        backgroundColor: "#e5e7eb",
    },
    secondaryLabel: {
        color: "#111827",
        fontWeight: "500",
    },

    // Venue-specific styles
    venueCard: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#f9fafb",
        marginBottom: 12,
    },
    venueSectionTitle: {
        fontSize: 13,
        fontWeight: "600",
        color: "#111827",
        marginBottom: 2,
    },
    venueHint: {
        fontSize: 12,
        color: "#6b7280",
        marginBottom: 8,
    },
    buttonSmall: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonGrey: {
        backgroundColor: "#e5e7eb",
    },
    buttonClearVenue: {
        backgroundColor: "#fee2e2",
        marginTop: 8,
    },
    buttonSmallLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#111827",
    },
    venueResultsList: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
    },
    venueResult: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    venueResultName: {
        fontSize: 14,
        fontWeight: "500",
    },
    venueResultCoords: {
        fontSize: 12,
        color: "#6b7280",
    },
    selectedVenueBox: {
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#eff6ff",
    },
    selectedVenueTitle: {
        fontSize: 12,
        fontWeight: "600",
        color: "#1d4ed8",
        marginBottom: 2,
    },
    selectedVenueName: {
        fontSize: 14,
        fontWeight: "600",
    },
    selectedVenueCoords: {
        fontSize: 12,
        color: "#4b5563",
    },
    venueDivider: {
        height: 1,
        backgroundColor: "#e5e7eb",
        marginVertical: 10,
    },
});

export default CompetitionFormScreen;
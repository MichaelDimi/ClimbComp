export type Competition = {
    id: string;
    title: string;
    description: string | null;
    is_public: boolean;
    venue_id: string | null;
    venue_name?: string | null;
    starts_at: string | null;
    ends_at: string | null;
    show_grades?: boolean;
    scoring_mode?: string;
    rules?: string[];
    created_by: string | null;
    created_at: string;
};

export type Venue = {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    created_at: string;
};

export type Division = {
    id: string;
    competition_id: string;
    name: string;
    sort_order: number | null;
    created_at: string;
};

export type CompetitionParticipant = {
    competition_id: string;
    user_id: string;
    division_id: string | null;
    joined_at: string;
    display_name: string;
    email: string;
    division_name: string | null;
};

export interface Problem {
    id: string;
    competition_id: string;
    division_id: string | null;
    code: string;
    discipline: string;
    grade: string | null;
    image_url: string | null;
    created_at: string;
    division_name?: string | null;
}

export interface Ascent {
    problem_id: string;
    user_id: string;
    topped: boolean;
    top_attempts: number | null;
    zone: boolean;
    zone_attempts: number | null;
    user_display_name?: string;
    user_email?: string;
}

export interface ProblemWithMyAscent extends Problem {
    my_ascent?: Ascent | null;
}

export interface CompetitionReportStanding {
    user_id: string;
    user_display_name: string;
    rank: number;
    total_tops: number;
    total_zones: number;
    total_top_attempts: number;
    total_zone_attempts: number;
}

export interface CompetitionReportDivision {
    division_id: string;
    division_name: string;
    participant_count: number;
    problem_count: number;
    total_tops: number;
    total_zones: number;
    podium: CompetitionReportStanding[];
}

export interface CompetitionReport {
    competition: {
        id: string;
        title: string;
    };
    divisions: CompetitionReportDivision[];
}



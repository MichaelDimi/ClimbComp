import { API_BASE } from "./config";
import { Competition, Venue, Division, CompetitionParticipant, Ascent, Problem, ProblemWithMyAscent, CompetitionReport } from "./types";

async function request<T>(
    path: string,
    options: RequestInit = {},
    token?: string
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    let data: any = null;
    try {
        data = await res.json();
    } catch {
        // ignore JSON parse errors for empty bodies
    }

    if (!res.ok) {
        const message = data?.error || `Request failed with status ${res.status}`;
        throw new Error(message);
    }

    return data as T;
}

// ---- competitions & venues ----

export type CreateCompetitionInput = {
    title: string;
    description?: string;
    venue_id?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    is_public?: boolean;
};

export type CreateVenueInput = {
    name: string;
    latitude: number;
    longitude: number;
};

export type UpdateCompetitionInput = {
    title?: string;
    description?: string | null;
    venue_id?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    is_public?: boolean;
};

// ---- problems & ascents ----

export type CreateProblemInput = {
    code: string;
    division_id?: string | null;
    discipline?: string;
    grade?: string | null;
};

export type SaveMyAscentInput = {
    topped: boolean;
    top_attempts: number | null;
    zone: boolean;
    zone_attempts: number | null;
};

export async function fetchCompetitions(
    search?: string,
    token?: string
): Promise<Competition[]> {
    const qs =
        search && search.trim().length > 0
            ? `?search=${encodeURIComponent(search.trim())}`
            : "";
    return request<Competition[]>(`/api/competitions${qs}`, {
        method: "GET",
    }, token);
}

export async function createCompetition(
    input: CreateCompetitionInput,
    token: string
): Promise<Competition> {
    return request<Competition>(
        "/api/competitions",
        {
            method: "POST",
            body: JSON.stringify(input),
        },
        token
    );
}

export async function updateCompetition(
    id: string,
    input: UpdateCompetitionInput,
    token: string
): Promise<Competition> {
    return request<Competition>(
        `/api/competitions/${id}`,
        {
            method: "PUT",
            body: JSON.stringify(input),
        },
        token
    );
}

export async function deleteCompetition(
    id: string,
    token: string
): Promise<void> {
    await request<unknown>(
        `/api/competitions/${id}`,
        { method: "DELETE" },
        token
    );
}


export async function fetchVenues(search?: string): Promise<Venue[]> {
    const qs =
        search && search.trim().length > 0
            ? `?search=${encodeURIComponent(search.trim())}`
            : "";
    return request<Venue[]>(
        `/api/venues${qs}`,
        { method: "GET" }
    );
}

export async function createVenue(
    input: CreateVenueInput,
    token: string
): Promise<Venue> {
    return request<Venue>(
        "/api/venues",
        {
            method: "POST",
            body: JSON.stringify(input),
        },
        token
    );
}

export async function fetchCompetitionById(
    id: string,
    token?: string
): Promise<Competition> {
    return request<Competition>(
        `/api/competitions/${id}`,
        { method: "GET" },
        token
    );
}

export async function fetchDivisions(
    competitionId: string,
    token?: string
): Promise<Division[]> {
    return request<Division[]>(
        `/api/competitions/${competitionId}/divisions`,
        { method: "GET" },
        token
    );
}

export async function fetchCompetitionParticipants(
    competitionId: string,
    token?: string
): Promise<CompetitionParticipant[]> {
    return request<CompetitionParticipant[]>(
        `/api/competitions/${competitionId}/participants`,
        { method: "GET" },
        token
    );
}

export async function joinCompetition(
    competitionId: string,
    division_id: string | null,
    token: string
): Promise<CompetitionParticipant> {
    return request<CompetitionParticipant>(
        `/api/competitions/${competitionId}/join`,
        {
            method: "POST",
            body: JSON.stringify({ division_id }),
        },
        token
    );
}

export async function createDivision(
    competitionId: string,
    name: string,
    token: string
): Promise<Division> {
    return request<Division>(
        `/api/competitions/${competitionId}/divisions`,
        {
            method: "POST",
            body: JSON.stringify({ name }),
        },
        token
    );
}

export async function deleteDivision(
    competitionId: string,
    divisionId: string,
    token: string
): Promise<void> {
    await request<unknown>(
        `/api/competitions/${competitionId}/divisions/${divisionId}`,
        {
            method: "DELETE",
        },
        token
    );
}

// ---- problems & ascents ----

export async function createProblem(
    competitionId: string,
    input: CreateProblemInput,
    token: string
): Promise<Problem> {
    return request<Problem>(
        `/api/competitions/${competitionId}/problems`,
        {
            method: "POST",
            body: JSON.stringify(input),
        },
        token
    );
}

export async function deleteProblem(
    problemId: string,
    token: string
): Promise<void> {
    await request<unknown>(
        `/api/problems/${problemId}`,
        { method: "DELETE" },
        token
    );
}

export type SaveAscentInput = {
    topped: boolean;
    top_attempts: number | null;
    zone: boolean;
    zone_attempts: number | null;
};

export async function fetchProblemsForCompetition(
    competitionId: string,
    token?: string
): Promise<ProblemWithMyAscent[]> {
    const rows = await request<any[]>(
        `/api/competitions/${competitionId}/problems`,
        { method: "GET" },
        token
    );

    return rows.map((row) => {
        const base: Problem = {
            id: row.id,
            competition_id: row.competition_id,
            division_id: row.division_id ?? null,
            code: row.code,
            discipline: row.discipline ?? "boulder",
            grade: row.grade ?? null,
            image_url: row.image_url ?? null,
            created_at: row.created_at,
            division_name: row.division_name ?? null,
        };

        let my_ascent: Ascent | null = null;

        // Map the my_* fields produced by the backend route above
        if (
            row.my_topped !== undefined ||
            row.my_zone !== undefined ||
            row.my_top_attempts !== undefined ||
            row.my_zone_attempts !== undefined
        ) {
            my_ascent = {
                problem_id: row.id,
                user_id: "", // not used in UI right now
                topped: !!row.my_topped,
                top_attempts:
                    row.my_top_attempts === null || row.my_top_attempts === undefined
                        ? null
                        : Number(row.my_top_attempts),
                zone: !!row.my_zone,
                zone_attempts:
                    row.my_zone_attempts === null || row.my_zone_attempts === undefined
                        ? null
                        : Number(row.my_zone_attempts),
            };
        }

        return {
            ...base,
            my_ascent,
        } as ProblemWithMyAscent;
    });
}

export async function saveMyAscent(
    problemId: string,
    input: SaveAscentInput,
    token: string
): Promise<Ascent> {
    return request<Ascent>(
        `/api/problems/${problemId}/ascents`,
        {
            method: "POST",
            body: JSON.stringify(input),
        },
        token
    );
}

// REPORT Endpoints

export async function fetchCompetitionReport(
    competitionId: string,
    divisionId?: string
): Promise<CompetitionReport> {
    const qs = divisionId
        ? `?division_id=${encodeURIComponent(divisionId)}`
        : "";
    return request<CompetitionReport>(
        `/api/reports/competition/${competitionId}/summary${qs}`,
        { method: "GET" }
    );
}

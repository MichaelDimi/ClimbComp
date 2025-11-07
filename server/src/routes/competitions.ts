import { Router } from "express";
import { query } from "../db";
import { requireAuth, optionalAuth, AuthRequest } from "../auth";

const router = Router();

interface CompetitionRow {
    id: string;
    title: string;
    description: string | null;
    is_public: boolean;
    venue_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
    show_grades: boolean;
    scoring_mode: string;
    rules: string[];
    created_by: string | null;
    created_at: string;
    venue_name?: string | null;
}

interface DivisionRow {
    id: string;
    competition_id: string;
    name: string;
    sort_order: number | null;
    created_at: string;
}

interface ParticipantRow {
    competition_id: string;
    user_id: string;
    division_id: string | null;
    joined_at: string;
    display_name: string;
    email: string;
    division_name: string | null;
}

interface ProblemRow {
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

/**
 * GET /api/competitions
 * List competitions, with optional filters:
 *   ?search= (substring of title, case-insensitive)
 *   ?venue_id= (exact venue id)
 *   ?upcoming=true  (only comps with starts_at >= now())
 *
 * Visibility:
 *   - Anonymous: only public competitions (is_public = true)
 *   - Logged-in: public competitions OR competitions you created
 */
router.get("/", optionalAuth, async (req: AuthRequest, res, next) => {
    try {
        const { search, venue_id, upcoming } = req.query as {
            search?: string;
            venue_id?: string;
            upcoming?: string;
        };

        const where: string[] = [];
        const params: any[] = [];

        const userId = req.user?.id;

        // Visibility:
        // - logged in: public comps OR comps you created
        // - not logged in: only public comps
        if (userId) {
            params.push(userId);
            const paramIndex = params.length; // 1
            where.push(`(c.is_public = true OR c.created_by = $${paramIndex})`);
        } else {
            where.push("c.is_public = true");
        }

        if (search && search.trim() !== "") {
            params.push(`%${search.toLowerCase()}%`);
            const paramIndex = params.length; // next number
            where.push(`LOWER(c.title) LIKE $${paramIndex}`);
        }

        if (venue_id) {
            params.push(venue_id);
            const paramIndex = params.length;
            where.push(`c.venue_id = $${paramIndex}`);
        }

        if (upcoming === "true") {
            where.push("c.starts_at >= now()");
        }

        const sql = `
        SELECT
          c.id,
          c.title,
          c.description,
          c.is_public,
          c.venue_id,
          c.starts_at,
          c.ends_at,
          c.show_grades,
          c.scoring_mode,
          c.rules,
          c.created_by,
          c.created_at,
          v.name AS venue_name
        FROM competitions c
        LEFT JOIN venues v ON c.venue_id = v.id
        WHERE ${where.join(" AND ")}
        ORDER BY c.starts_at NULLS LAST, c.created_at DESC
      `;

        const rows = await query<CompetitionRow>(sql, params);
        res.json(rows);
    } catch (e) {
        next(e);
    }
});

/**
 * GET /api/competitions/nearby
 * Find public competitions near a given lat/lon.
 *
 * Query params:
 *   lat        (required) latitude in decimal degrees
 *   lon        (required) longitude in decimal degrees
 *   radius_km  (optional) search radius in kilometers (default 50)
 */
router.get("/nearby", async (req, res, next) => {
    try {
        const { lat, lon, radius_km } = req.query as {
            lat?: string;
            lon?: string;
            radius_km?: string;
        };

        if (!lat || !lon) {
            return res
                .status(400)
                .json({ error: "lat and lon query params are required" });
        }

        const centerLat = Number(lat);
        const centerLon = Number(lon);

        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) {
            return res
                .status(400)
                .json({ error: "lat and lon must be valid numbers" });
        }

        const radiusKm =
            radius_km && Number(radius_km) > 0 ? Number(radius_km) : 50;

        // Rough conversions: ~111 km per degree latitude, longitude scaled by cos(lat)
        const latDelta = radiusKm / 111.0;
        const lonDelta =
            radiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180));

        const minLat = centerLat - latDelta;
        const maxLat = centerLat + latDelta;
        const minLon = centerLon - lonDelta;
        const maxLon = centerLon + lonDelta;

        interface NearbyCompetitionRow {
            id: string;
            title: string;
            description: string | null;
            is_public: boolean;
            starts_at: string | null;
            ends_at: string | null;
            created_at: string;
            venue_id: string;
            venue_name: string;
            venue_latitude: number;
            venue_longitude: number;
            distance_km: number;
        }

        const sql = `
        SELECT
          c.id,
          c.title,
          c.description,
          c.is_public,
          c.starts_at,
          c.ends_at,
          c.created_at,
          v.id          AS venue_id,
          v.name        AS venue_name,
          v.latitude    AS venue_latitude,
          v.longitude   AS venue_longitude,
          sqrt(
            power((v.latitude  - $1) * 111.0, 2) +
            power((v.longitude - $2) * 111.0 * cos(radians($1)), 2)
          ) AS distance_km
        FROM competitions c
        JOIN venues v ON c.venue_id = v.id
        WHERE
          c.is_public = true
          AND v.latitude  BETWEEN $3 AND $4
          AND v.longitude BETWEEN $5 AND $6
        ORDER BY distance_km ASC, c.starts_at NULLS LAST, c.created_at DESC
        LIMIT 50
      `;

        const params = [centerLat, centerLon, minLat, maxLat, minLon, maxLon];

        const comps = await query<NearbyCompetitionRow>(sql, params);
        return res.json(comps);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/competitions/:id/divisions
 * List divisions for a competition.
 */
router.get("/:id/divisions", async (req, res, next) => {
    try {
        const { id } = req.params;

        const divisions = await query<DivisionRow>(
            `
        SELECT id, competition_id, name, sort_order, created_at
        FROM divisions
        WHERE competition_id = $1
        ORDER BY sort_order NULLS LAST, name ASC
        `,
            [id]
        );

        res.json(divisions);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/competitions/:id/divisions
 * Create a new division for a competition.
 * Only the competition's creator can add divisions.
 *
 * Body:
 *   { name: string, sort_order?: number }
 */
router.post("/:id/divisions", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { id } = req.params;
        const { name, sort_order } = req.body as {
            name?: string;
            sort_order?: number;
        };

        if (!name || name.trim() === "") {
            return res.status(400).json({ error: "name is required" });
        }

        // Check that the competition exists and is owned by this user
        const comps = await query<CompetitionRow>(`
            SELECT id, created_by
            FROM competitions
            WHERE id = $1
        `,
            [id]
        );
        const comp = comps[0];
        if (!comp) {
            return res.status(404).json({ error: "Competition not found" });
        }
        if (comp.created_by !== req.user.id) {
            return res
                .status(403)
                .json({ error: "Only the competition creator can add divisions" });
        }

        const inserted = await query<DivisionRow>(`
            INSERT INTO divisions (competition_id, name, sort_order)
            VALUES ($1, $2, $3)
            RETURNING id, competition_id, name, sort_order, created_at
        `,
            [id, name.trim(), sort_order ?? null]
        );

        const division = inserted[0];
        res.status(201).json(division);
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/competitions/:id/divisions/:divisionId
 * Delete a division (only if competition creator and division has no participants).
 */
router.delete(
    "/:id/divisions/:divisionId",
    requireAuth,
    async (req: AuthRequest, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Unauthenticated" });
            }

            const { id, divisionId } = req.params;

            // Check competition ownership
            const comps = await query<CompetitionRow>(
                `
          SELECT id, created_by
          FROM competitions
          WHERE id = $1
          `,
                [id]
            );
            const comp = comps[0];
            if (!comp) {
                return res.status(404).json({ error: "Competition not found" });
            }
            if (comp.created_by !== req.user.id) {
                return res.status(403).json({
                    error: "Only the competition creator can delete divisions",
                });
            }

            // Ensure division belongs to this competition
            const divs = await query<DivisionRow>(
                `
          SELECT id
          FROM divisions
          WHERE id = $1 AND competition_id = $2
          `,
                [divisionId, id]
            );
            if (divs.length === 0) {
                return res
                    .status(404)
                    .json({ error: "Division not found in this competition" });
            }

            // Check for participants assigned to this division
            const participants = await query<{ count: string }>(
                `
          SELECT COUNT(*)::text AS count
          FROM competition_participants
          WHERE competition_id = $1 AND division_id = $2
          `,
                [id, divisionId]
            );
            const count = Number(participants[0]?.count ?? "0");
            if (count > 0) {
                return res.status(400).json({
                    error: "Cannot delete a division that has participants",
                });
            }

            await query(
                `
          DELETE FROM divisions
          WHERE id = $1 AND competition_id = $2
          `,
                [divisionId, id]
            );

            return res.status(204).send();
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/competitions/:id/participants
 * List participants for a competition, with user + division info.
 */
router.get("/:id/participants", async (req, res, next) => {
    try {
        const { id } = req.params;

        const rows = await query<ParticipantRow>(
            `
        SELECT
          cp.competition_id,
          cp.user_id,
          cp.division_id,
          cp.joined_at,
          u.display_name,
          u.email,
          d.name AS division_name
        FROM competition_participants cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN divisions d ON cp.division_id = d.id
        WHERE cp.competition_id = $1
        ORDER BY cp.joined_at ASC
        `,
            [id]
        );

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/competitions/:id/join
 * Join the current user to a competition (or update their division).
 *
 * Body:
 *   { division_id?: string }
 */
router.post("/:id/join", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { id } = req.params;
        const { division_id } = req.body as { division_id?: string };

        // Ensure competition exists and is public (for now)
        const comps = await query<CompetitionRow>(
            `
        SELECT id, is_public, starts_at
        FROM competitions
        WHERE id = $1
        `,
            [id]
        );
        const comp = comps[0];
        if (!comp) {
            return res.status(404).json({ error: "Competition not found" });
        }
        if (!comp.is_public) {
            // You can relax this later / add invite-only logic
            return res.status(403).json({ error: "Competition is not open for public registration" });
        }

        //disallow joining at or after start time(if defined)
        if (comp.starts_at && new Date(comp.starts_at) <= new Date()) {
            return res
                .status(403)
                .json({ error: "Registration is closed for this competition" });
        }

        // Optional: if division_id is provided, verify it belongs to this competition
        if (division_id) {
            const divs = await query<DivisionRow>(
                `
          SELECT id
          FROM divisions
          WHERE id = $1 AND competition_id = $2
          `,
                [division_id, id]
            );
            if (divs.length === 0) {
                return res.status(400).json({ error: "Invalid division for this competition" });
            }
        }

        // Upsert participant row
        const rows = await query<ParticipantRow>(
            `
        INSERT INTO competition_participants (competition_id, user_id, division_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (competition_id, user_id)
        DO UPDATE
        SET division_id = EXCLUDED.division_id,
            joined_at   = now()
        RETURNING
          competition_id,
          user_id,
          division_id,
          joined_at,
          (SELECT display_name FROM users WHERE id = $2) AS display_name,
          (SELECT email FROM users WHERE id = $2) AS email,
          (SELECT name FROM divisions WHERE id = competition_participants.division_id) AS division_name
        `,
            [id, req.user.id, division_id ?? null]
        );

        const participant = rows[0];
        res.status(201).json(participant);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/competitions/:id/problems
 * List problems for a competition, plus the current user's ascent (if logged in).
 */
router.get(
    "/:id/problems",
    optionalAuth,
    async (req: AuthRequest, res, next) => {
        try {
            const { id } = req.params; // competition id
            const userId = req.user?.id ?? null;

            const params: any[] = [id];

            const myFieldsWhenNoUser = `
          NULL AS my_topped,
          NULL AS my_top_attempts,
          NULL AS my_zone,
          NULL AS my_zone_attempts
        `;

            let mySelect = myFieldsWhenNoUser;
            let ascentJoin = "";

            if (userId) {
                params.push(userId);
                mySelect = `
            a.topped        AS my_topped,
            a.top_attempts  AS my_top_attempts,
            a.zone          AS my_zone,
            a.zone_attempts AS my_zone_attempts
          `;
                ascentJoin = `
            LEFT JOIN ascents a
              ON a.problem_id = p.id
             AND a.user_id = $2
          `;
            }

            const rows = await query<any>(
                `
          SELECT
            p.id,
            p.competition_id,
            p.division_id,
            p.code,
            p.discipline,
            p.grade,
            p.image_url,
            p.created_at,
            d.name AS division_name,
            ${mySelect}
          FROM problems p
          LEFT JOIN divisions d
            ON d.id = p.division_id
          ${ascentJoin}
          WHERE p.competition_id = $1
          ORDER BY p.code ASC, p.created_at ASC
          `,
                params
            );

            res.json(rows);
        } catch (err) {
            next(err);
        }
    }
);

/**
 * POST /api/competitions/:id/problems
 * Create a new problem in a competition.
 * Only the competition creator can add problems.
 *
 * Body:
 *   {
 *     code: string,
 *     discipline: string,
 *     grade?: string,
 *     division_id?: string,
 *     image_url?: string
 *   }
 */
router.post("/:id/problems", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { id } = req.params;
        const {
            code,
            discipline,
            grade,
            division_id,
            image_url,
        } = req.body as {
            code?: string;
            discipline?: string;
            grade?: string;
            division_id?: string;
            image_url?: string;
        };

        if (!code || code.trim() === "") {
            return res.status(400).json({ error: "code is required" });
        }
        if (!discipline || discipline.trim() === "") {
            return res.status(400).json({ error: "discipline is required" });
        }

        // Check that the competition exists and is owned by this user
        const comps = await query<CompetitionRow>(
            `
            SELECT id, created_by
            FROM competitions
            WHERE id = $1
            `,
            [id]
        );
        const comp = comps[0];
        if (!comp) {
            return res.status(404).json({ error: "Competition not found" });
        }
        if (comp.created_by !== req.user.id) {
            return res
                .status(403)
                .json({ error: "Only the competition creator can add problems" });
        }

        // If division_id is provided, verify it belongs to this competition
        let divisionIdToUse: string | null = null;
        if (division_id) {
            const divs = await query<DivisionRow>(
                `
                SELECT id
                FROM divisions
                WHERE id = $1 AND competition_id = $2
                `,
                [division_id, id]
            );
            if (divs.length === 0) {
                return res.status(400).json({ error: "Invalid division for this competition" });
            }
            divisionIdToUse = division_id;
        }

        const inserted = await query<ProblemRow>(
            `
            INSERT INTO problems (
              competition_id,
              division_id,
              code,
              discipline,
              grade,
              image_url
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
              id,
              competition_id,
              division_id,
              code,
              discipline,
              grade,
              image_url,
              created_at
            `,
            [
                id,
                divisionIdToUse,
                code.trim(),
                discipline.trim(),
                grade ?? null,
                image_url ?? null,
            ]
        );

        const problem = inserted[0];
        res.status(201).json(problem);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/competitions/:id
 * Get a single competition with venue info.
 */
router.get("/:id", optionalAuth, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const rows = await query<CompetitionRow>(
            `
        SELECT
          c.id,
          c.title,
          c.description,
          c.is_public,
          c.venue_id,
          c.starts_at,
          c.ends_at,
          c.show_grades,
          c.scoring_mode,
          c.rules,
          c.created_by,
          c.created_at,
          v.name AS venue_name
        FROM competitions c
        LEFT JOIN venues v ON c.venue_id = v.id
        WHERE c.id = $1
        `,
            [id]
        );

        const comp = rows[0];
        if (!comp) {
            return res.status(404).json({ error: "Competition not found" });
        }

        res.json(comp);
    } catch (e) {
        next(e);
    }
});

/**
 * POST /api/competitions
 * Create a new competition.
 * Auth required: created_by = req.user.id.
 */
router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const {
            title,
            description,
            venue_id,
            starts_at,
            ends_at,
            is_public,
            show_grades,
            scoring_mode,
            rules,
        } = req.body as {
            title?: string;
            description?: string;
            venue_id?: string | null;
            starts_at?: string | null;
            ends_at?: string | null;
            is_public?: boolean;
            show_grades?: boolean;
            scoring_mode?: string;
            rules?: string[];
        };

        if (!title || title.trim() === "") {
            return res.status(400).json({ error: "title is required" });
        }

        // Use DB defaults for most fields if not provided
        const inserted = await query<CompetitionRow>(
            `
        INSERT INTO competitions (
          title,
          description,
          venue_id,
          starts_at,
          ends_at,
          is_public,
          show_grades,
          scoring_mode,
          rules,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5,
                COALESCE($6, true),
                COALESCE($7, false),
                COALESCE($8, 'TOPS_ATTEMPTS'),
                COALESCE($9::text[], '{}'::text[]),
                $10)
        RETURNING *
        `,
            [
                title.trim(),
                description ?? null,
                venue_id ?? null,
                starts_at ?? null,
                ends_at ?? null,
                typeof is_public === "boolean" ? is_public : null,
                typeof show_grades === "boolean" ? show_grades : null,
                scoring_mode ?? null,
                rules ?? null,
                req.user.id,
            ]
        );

        const comp = inserted[0];
        res.status(201).json(comp);
    } catch (e) {
        next(e);
    }
});

/**
 * PUT /api/competitions/:id
 * Update a competition you created.
 * Simple rule: only creator can edit.
 */
router.put("/:id", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { id } = req.params;
        const {
            title,
            description,
            venue_id,
            starts_at,
            ends_at,
            is_public,
            show_grades,
            scoring_mode,
            rules,
        } = req.body as {
            title?: string;
            description?: string;
            venue_id?: string | null;
            starts_at?: string | null;
            ends_at?: string | null;
            is_public?: boolean;
            show_grades?: boolean;
            scoring_mode?: string;
            rules?: string[];
        };

        const fields: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (title !== undefined) {
            fields.push(`title = $${idx++}`);
            params.push(title.trim());
        }
        if (description !== undefined) {
            fields.push(`description = $${idx++}`);
            params.push(description);
        }
        if (venue_id !== undefined) {
            fields.push(`venue_id = $${idx++}`);
            params.push(venue_id);
        }
        if (starts_at !== undefined) {
            fields.push(`starts_at = $${idx++}`);
            params.push(starts_at);
        }
        if (ends_at !== undefined) {
            fields.push(`ends_at = $${idx++}`);
            params.push(ends_at);
        }
        if (is_public !== undefined) {
            fields.push(`is_public = $${idx++}`);
            params.push(is_public);
        }
        if (show_grades !== undefined) {
            fields.push(`show_grades = $${idx++}`);
            params.push(show_grades);
        }
        if (scoring_mode !== undefined) {
            fields.push(`scoring_mode = $${idx++}`);
            params.push(scoring_mode);
        }
        if (rules !== undefined) {
            fields.push(`rules = $${idx++}`);
            params.push(rules);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        // Restrict updates to competitions created by the current user
        const sql = `
            UPDATE competitions
            SET ${fields.join(", ")}
            WHERE id = $${idx++} AND created_by = $${idx}
            RETURNING *
        `;
        params.push(id, req.user.id);

        const updated = await query<CompetitionRow>(sql, params);
        const comp = updated[0];

        if (!comp) {
            // Either not found or not created by this user
            return res.status(404).json({ error: "Competition not found or not owned by user" });
        }

        res.json(comp);
    } catch (e) {
        next(e);
    }
});

/**
 * DELETE /api/competitions/:id
 * Delete a competition you created.
 */
router.delete("/:id", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { id } = req.params;

        const deleted = await query<CompetitionRow>(`
            DELETE FROM competitions
            WHERE id = $1 AND created_by = $2
            RETURNING *
        `,
            [id, req.user.id]
        );

        if (deleted.length === 0) {
            return res.status(404).json({ error: "Competition not found or not owned by user" });
        }

        res.status(204).send();
    } catch (e) {
        next(e);
    }
});

export default router;
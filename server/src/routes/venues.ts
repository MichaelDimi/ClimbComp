import { Router } from "express";
import { query } from "../db";
import { requireAuth, AuthRequest } from "../auth";

const router = Router();

interface VenueRow {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    created_at: string;
}

/**
 * GET /api/venues
 * Optional query params:
 *   ?search=   substring match on name (case-insensitive)
 *   ?limit=    max number of venues to return (default 50)
 *
 * This is the main endpoint to populate venue dropdowns and map markers.
 */
router.get("/", async (req, res, next) => {
    try {
        const { search, limit } = req.query as {
            search?: string;
            limit?: string;
        };

        const where: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (search && search.trim() !== "") {
            where.push(`LOWER(name) LIKE $${idx++}`);
            params.push(`%${search.toLowerCase()}%`);
        }

        const lim = limit ? Math.min(Number(limit) || 50, 200) : 50;

        const sql = `
            SELECT id, name, latitude, longitude, created_at
            FROM venues
            ${where.length ? "WHERE " + where.join(" AND ") : ""}
            ORDER BY name ASC
            LIMIT ${lim}
        `;

        const venues = await query<VenueRow>(sql, params);
        res.json(venues);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/venues/:id/competitions
 * Convenience endpoint: competitions at a given venue.
 * This plugs nicely into filters and reports.
 */
router.get("/:id/competitions", async (req, res, next) => {
    try {
        const { id } = req.params;

        const comps = await query<{
            id: string;
            title: string;
            starts_at: string | null;
            ends_at: string | null;
            is_public: boolean;
            created_at: string;
        }>(
            `
        SELECT
          c.id,
          c.title,
          c.starts_at,
          c.ends_at,
          c.is_public,
          c.created_at
        FROM competitions c
        WHERE c.venue_id = $1
        ORDER BY c.starts_at NULLS LAST, c.created_at DESC
        `,
            [id]
        );

        res.json(comps);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/venues/:id
 * Basic venue details (used for comp details screen, etc.)
 */
router.get("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const rows = await query<VenueRow>(
            `
        SELECT id, name, latitude, longitude, created_at
        FROM venues
        WHERE id = $1
        `,
            [id]
        );

        const venue = rows[0];
        if (!venue) {
            return res.status(404).json({ error: "Venue not found" });
        }

        res.json(venue);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/venues
 * Create a new venue.
 * Auth required (for now we treat any logged-in user as allowed).
 *
 * Body:
 *   { name: string, latitude: number, longitude: number }
 */
router.post("/", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { name, latitude, longitude } = req.body as {
            name?: string;
            latitude?: number;
            longitude?: number;
        };

        if (!name || name.trim() === "") {
            return res.status(400).json({ error: "name is required" });
        }

        if (typeof latitude !== "number" || typeof longitude !== "number") {
            return res.status(400).json({ error: "latitude and longitude must be numbers" });
        }

        const inserted = await query<VenueRow>(`
            INSERT INTO venues (name, latitude, longitude)
            VALUES ($1, $2, $3)
            RETURNING id, name, latitude, longitude, created_at
        `,
            [name.trim(), latitude, longitude]
        );

        const venue = inserted[0];
        res.status(201).json(venue);
    } catch (err) {
        next(err);
    }
});

export default router;
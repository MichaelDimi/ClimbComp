import { Router } from "express";
import { query } from "../db";
import { optionalAuth, requireAuth, AuthRequest } from "../auth";

const router = Router();

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

interface AscentRow {
    problem_id: string;
    user_id: string;
    topped: boolean;
    top_attempts: number | null;
    zone: boolean;
    zone_attempts: number | null;
    user_display_name: string;
    user_email: string;
}

/**
 * GET /api/problems/:id
 * Basic problem details + division name.
 */
router.get("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const rows = await query<ProblemRow>(
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
        d.name AS division_name
      FROM problems p
      LEFT JOIN divisions d ON p.division_id = d.id
      WHERE p.id = $1
      `,
            [id]
        );

        const problem = rows[0];
        if (!problem) {
            return res.status(404).json({ error: "Problem not found" });
        }

        res.json(problem);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/problems/:id/ascents
 * Upsert the current user's ascent for this problem.
 *
 * Body:
 *   {
 *     topped: boolean;
 *     top_attempts: number | null;
 *     zone: boolean;
 *     zone_attempts: number | null;
 *   }
 */
router.post("/:id/ascents", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const problemId = req.params.id;
        const userId = req.user.id;

        const {
            topped,
            top_attempts,
            zone,
            zone_attempts,
        } = req.body as {
            topped?: boolean;
            top_attempts?: number | null;
            zone?: boolean;
            zone_attempts?: number | null;
        };

        // Make sure problem exists (we don't actually need competition_id in this table)
        const problems = await query<{ id: string }>(
            `
        SELECT id
        FROM problems
        WHERE id = $1
        `,
            [problemId]
        );
        const problem = problems[0];
        if (!problem) {
            return res.status(404).json({ error: "Problem not found" });
        }

        interface AscentRow {
            problem_id: string;
            user_id: string;
            topped: boolean;
            top_attempts: number | null;
            zone: boolean;
            zone_attempts: number | null;
        }

        const rows = await query<AscentRow>(
            `
        INSERT INTO ascents (
          problem_id,
          user_id,
          topped,
          top_attempts,
          zone,
          zone_attempts
        )
        VALUES (
          $1,
          $2,
          COALESCE($3, false),
          $4,
          COALESCE($5, false),
          $6
        )
        ON CONFLICT (problem_id, user_id)
        DO UPDATE SET
          topped        = EXCLUDED.topped,
          top_attempts  = EXCLUDED.top_attempts,
          zone          = EXCLUDED.zone,
          zone_attempts = EXCLUDED.zone_attempts
        RETURNING *
        `,
            [
                problemId,
                userId,
                topped,
                top_attempts ?? null,
                zone,
                zone_attempts ?? null,
            ]
        );

        const a = rows[0];

        return res.json({
            problem_id: a.problem_id,
            user_id: a.user_id,
            topped: a.topped,
            top_attempts: a.top_attempts,
            zone: a.zone,
            zone_attempts: a.zone_attempts,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/problems/:id
 * Only the competition organizer can delete a problem.
 */
router.delete("/:id", requireAuth, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthenticated" });
        }

        const { id } = req.params;

        // Find the problem and its competition owner
        const rows = await query<{
            id: string;
            competition_id: string;
            created_by: string | null;
        }>(
            `
            SELECT
              p.id,
              p.competition_id,
              c.created_by
            FROM problems p
            JOIN competitions c
              ON p.competition_id = c.id
            WHERE p.id = $1
            `,
            [id]
        );

        const row = rows[0];
        if (!row) {
            return res.status(404).json({ error: "Problem not found" });
        }

        // Only the competition creator can delete problems
        if (!row.created_by || row.created_by !== req.user.id) {
            return res
                .status(403)
                .json({ error: "Only the competition organizer can delete problems" });
        }

        // Clean up ascents first (in case there is no ON DELETE CASCADE FK)
        await query(
            `
            DELETE FROM ascents
            WHERE problem_id = $1
            `,
            [id]
        );

        // Delete the problem itself
        await query(
            `
            DELETE FROM problems
            WHERE id = $1
            `,
            [id]
        );

        return res.status(204).send();
    } catch (err) {
        next(err);
    }
});

export default router;

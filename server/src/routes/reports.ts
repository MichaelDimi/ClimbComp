import { Router } from "express";
import { query } from "../db";

const router = Router();

interface CompetitionRow {
    id: string;
    title: string;
}

interface DivisionSummaryRow {
    division_id: string;
    division_name: string;
    participant_count: number;
    problem_count: number;
    total_tops: number;
    total_zones: number;
}

interface PodiumRow {
    competition_id: string;
    division_id: string;
    division_name: string;
    user_id: string;
    user_display_name: string;
    rank: number;
    total_tops: number;
    total_zones: number;
    total_top_attempts: number;
    total_zone_attempts: number;
}

/**
 * GET /api/reports/competition/:id/summary
 *
 * Optional query:
 *   ?division_id=...   -> restrict to a single division
 *
 * Returns:
 * {
 *   competition: { id, title },
 *   divisions: [
 *     {
 *       division_id,
 *       division_name,
 *       participant_count,
 *       problem_count,
 *       total_tops,
 *       total_zones,
 *       podium: [
 *         { user_id, user_display_name, rank, total_tops, ... }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 */
router.get("/competition/:id/summary", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { division_id } = req.query as { division_id?: string };

        // 1) Ensure competition exists
        const comps = await query<CompetitionRow>(
            `
      SELECT id, title
      FROM competitions
      WHERE id = $1
      `,
            [id]
        );
        const comp = comps[0];
        if (!comp) {
            return res.status(404).json({ error: "Competition not found" });
        }

        // 2) Division-level stats
        const summaryParams: any[] = [id];
        let divisionFilterClause = "";
        if (division_id) {
            divisionFilterClause = "AND d.id = $2";
            summaryParams.push(division_id);
        }

        const summarySql = `
            SELECT
                d.id   AS division_id,
                d.name AS division_name,

                -- # of unique users either joined in this division OR with ascents on its problems
                COALESCE((
                SELECT COUNT(DISTINCT du.user_id)
                FROM (
                    -- joined participants
                    SELECT cp.user_id
                    FROM competition_participants cp
                    WHERE cp.competition_id = $1
                    AND cp.division_id = d.id

                    UNION

                    -- users with ascents on problems in this division
                    SELECT a.user_id
                    FROM problems p
                    JOIN ascents a
                    ON a.problem_id = p.id
                    WHERE p.competition_id = $1
                    AND p.division_id = d.id
                ) AS du
                ), 0) AS participant_count,

                -- # of problems in this division for this competition
                COALESCE((
                SELECT COUNT(*)
                FROM problems p
                WHERE p.competition_id = $1
                    AND p.division_id = d.id
                ), 0) AS problem_count,

                -- total tops in this division
                COALESCE((
                SELECT COUNT(*)
                FROM problems p
                LEFT JOIN ascents a
                    ON a.problem_id = p.id
                WHERE p.competition_id = $1
                    AND p.division_id = d.id
                    AND a.topped
                ), 0) AS total_tops,

                -- total zones in this division
                COALESCE((
                SELECT COUNT(*)
                FROM problems p
                LEFT JOIN ascents a
                    ON a.problem_id = p.id
                WHERE p.competition_id = $1
                    AND p.division_id = d.id
                    AND a.zone
                ), 0) AS total_zones

            FROM divisions d
            WHERE d.competition_id = $1
            ${divisionFilterClause}
            ORDER BY d.sort_order NULLS LAST, d.name;
        `;

        const summaries = await query<DivisionSummaryRow>(summarySql, summaryParams);

        // 3) Podiums via stored procedure
        let podiumSql = "SELECT * FROM competition_division_podiums($1, 3)";
        const podiumParams: any[] = [id];

        if (division_id) {
            podiumSql += " WHERE division_id = $2";
            podiumParams.push(division_id);
        }

        const podiumRows = await query<PodiumRow>(podiumSql, podiumParams);

        // 4) Combine summaries + podiums
        const divisions = summaries.map((s) => ({
            ...s,
            podium: podiumRows
                .filter((p) => p.division_id === s.division_id)
                .map((p) => ({
                    user_id: p.user_id,
                    user_display_name: p.user_display_name,
                    rank: p.rank,
                    total_tops: p.total_tops,
                    total_zones: p.total_zones,
                    total_top_attempts: p.total_top_attempts,
                    total_zone_attempts: p.total_zone_attempts,
                })),
        }));

        return res.json({
            competition: {
                id: comp.id,
                title: comp.title,
            },
            divisions,
        });
    } catch (err) {
        next(err);
    }
});

export default router;

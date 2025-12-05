import { Pool, PoolClient, QueryResultRow } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: any[]
): Promise<T[]> {
    const res = await pool.query<T>(sql, params);
    return res.rows;
}

export async function withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
    isolation: "read committed" | "repeatable read" | "serializable" = "read committed"
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query(`BEGIN ISOLATION LEVEL ${isolation.toUpperCase()}`);
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
}




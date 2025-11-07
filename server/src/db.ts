import { Pool, QueryResultRow } from "pg";
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



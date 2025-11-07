import express from "express";
import bcrypt from "bcrypt";
import { query } from "../db";
import { issueToken, requireAuth, AuthRequest, AuthUser } from "../auth";

const router = express.Router();

interface UserRow {
    id: string;
    display_name: string;
    email: string;
    password_hash: string;
    created_at: string;
}

const SALT_ROUNDS = 10;

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
    try {
        const { display_name, email, password } = req.body as {
            display_name?: string;
            email?: string;
            password?: string;
        };

        if (!display_name || !email || !password) {
            return res.status(400).json({ error: "display_name, email, and password are required" });
        }

        const existing = await query<UserRow>(
            "select * from users where email = $1",
            [email.toLowerCase()]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const inserted = await query<UserRow>(
            `insert into users (display_name, email, password_hash)
             values ($1, $2, $3)
             returning id, display_name, email, password_hash, created_at`,
            [display_name, email.toLowerCase(), password_hash]
        );

        const userRow = inserted[0];
        const user: AuthUser = {
            id: userRow.id,
            display_name: userRow.display_name,
            email: userRow.email,
        };

        const token = issueToken(user);

        return res.status(201).json({ user, token });
    } catch (err) {
        return next(err);
    }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body as {
            email?: string;
            password?: string;
        };

        if (!email || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }

        const users = await query<UserRow>(
            "select * from users where email = $1",
            [email.toLowerCase()]
        );
        const userRow = users[0];
        if (!userRow) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const ok = await bcrypt.compare(password, userRow.password_hash);
        if (!ok) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user: AuthUser = {
            id: userRow.id,
            email: userRow.email,
            display_name: userRow.display_name,
        };
        const token = issueToken(user);

        return res.json({ user, token });
    } catch (err) {
        return next(err);
    }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthenticated" });
    }
    return res.json({ user: req.user });
});

export default router;

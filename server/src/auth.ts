import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET env var is required");
}
const JWT_SECRET = process.env.JWT_SECRET as string

export interface AuthUser {
    id: string;
    email: string;
    display_name: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

export function issueToken(user: AuthUser): string {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            display_name: user.display_name,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

export function requireAuth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = header.slice("Bearer ".length);

    try {
        const payload = jwt.verify(token, JWT_SECRET as string) as {
            sub: string;
            email: string;
            display_name: string;
        };

        req.user = {
            id: payload.sub,
            email: payload.email,
            display_name: payload.display_name,
        };

        return next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// Optional helper: attaches user if token present, but doesn't error if missing
export function optionalAuth(
    req: AuthRequest,
    _res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return next();
    }

    const token = header.slice("Bearer ".length);

    try {
        const payload = jwt.verify(token, JWT_SECRET) as {
            sub: string;
            email: string;
            display_name: string;
        };

        req.user = {
            id: payload.sub,
            email: payload.email,
            display_name: payload.display_name,
        };
    } catch {
        // Ignore invalid tokens here; request just proceeds as unauthenticated
    }

    return next();
}

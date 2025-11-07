import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { API_BASE } from "../config";

export type AuthUser = {
    id: string;
    display_name: string;
    email: string;
};

type AuthContextValue = {
    user: AuthUser | null;
    token: string | null;
    authLoading: boolean;
    authError: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (
        displayName: string,
        email: string,
        password: string
    ) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// --- simple localStorage helpers (web) ---

const STORAGE_KEY = "climbcomp_auth";

function saveAuthToStorage(user: AuthUser, token: string) {
    if (typeof window === "undefined") return;
    const ls = (window as any).localStorage;
    if (!ls) return;
    ls.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
}

function clearAuthStorage() {
    if (typeof window === "undefined") return;
    const ls = (window as any).localStorage;
    if (!ls) return;
    ls.removeItem(STORAGE_KEY);
}

function loadAuthFromStorage():
    | { user: AuthUser; token: string }
    | null {
    if (typeof window === "undefined") return null;
    const ls = (window as any).localStorage;
    if (!ls) return null;
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && parsed.token) {
            return {
                user: parsed.user as AuthUser,
                token: String(parsed.token),
            };
        }
    } catch {
        // ignore parse errors
    }
    return null;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // On first mount, try to hydrate from localStorage
    useEffect(() => {
        const saved = loadAuthFromStorage();
        if (saved) {
            setUser(saved.user);
            setToken(saved.token);
        }
    }, []);

    const clearAuth = () => {
        setUser(null);
        setToken(null);
        clearAuthStorage();
    };

    const login = useCallback(async (email: string, password: string) => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Login failed");
            }

            setUser(data.user);
            setToken(data.token);
            saveAuthToStorage(data.user, data.token);
        } catch (err: any) {
            console.error("Login error", err);
            setAuthError(err.message || "Login failed");
            clearAuth();
        } finally {
            setAuthLoading(false);
        }
    }, []);

    const register = useCallback(
        async (displayName: string, email: string, password: string) => {
            setAuthLoading(true);
            setAuthError(null);
            try {
                const res = await fetch(`${API_BASE}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        display_name: displayName,
                        email,
                        password,
                    }),
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || "Registration failed");
                }

                setUser(data.user);
                setToken(data.token);
                saveAuthToStorage(data.user, data.token);
            } catch (err: any) {
                console.error("Register error", err);
                setAuthError(err.message || "Registration failed");
                clearAuth();
            } finally {
                setAuthLoading(false);
            }
        },
        []
    );

    const logout = useCallback(() => {
        clearAuth();
    }, []);

    const value: AuthContextValue = {
        user,
        token,
        authLoading,
        authError,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};
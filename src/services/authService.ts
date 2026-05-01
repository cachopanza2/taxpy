export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

const TOKEN_KEY = "taxflow_token";
const USER_KEY = "taxflow_user";

async function apiFetch(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data as { token: string; user: AuthUser };
}

export const AuthService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? (JSON.parse(s) as AuthUser) : null;
    } catch {
      return null;
    }
  },

  setSession(token: string, user: AuthUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async login(email: string, password: string): Promise<AuthUser> {
    const { token, user } = await apiFetch("/api/auth/login", { email, password });
    this.setSession(token, user);
    return user;
  },

  async register(email: string, password: string, name: string): Promise<AuthUser> {
    const { token, user } = await apiFetch("/api/auth/register", { email, password, name });
    this.setSession(token, user);
    return user;
  },

  async loginWithGoogle(idToken: string): Promise<AuthUser> {
    const { token, user } = await apiFetch("/api/auth/google", { idToken });
    this.setSession(token, user);
    return user;
  },

  logout() {
    this.clearSession();
    window.location.href = "/";
  },
};

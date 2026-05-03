import React, { useState, useEffect } from "react";
import { ScanLine, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthService, AuthUser } from "../services/authService";

interface Props {
  onLogin: (user: AuthUser) => void;
}

const GOOGLE_CLIENT_ID =
  (process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "") || undefined;

export const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Google OAuth redirect callback (id_token arrives in URL hash)
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const idToken = hash.get("id_token");
    if (!idToken) return;

    // Clean the URL
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    setLoading(true);
    setError(null);
    AuthService.loginWithGoogle(idToken)
      .then(onLogin)
      .catch((e) => setError(e instanceof Error ? e.message : "Error con Google"))
      .finally(() => setLoading(false));
  }, [onLogin]);

  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID) return;
    const nonce = (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: window.location.origin + "/",
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        tab === "login"
          ? await AuthService.login(email, password)
          : await AuthService.register(email, password, name);
      onLogin(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-4">
          <ScanLine className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          TaxFlow<span className="text-emerald-400">.py</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1 font-medium">
          Gestión Tributaria Paraguay
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 rounded-t-3xl overflow-hidden">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`flex-1 py-4 text-sm font-bold transition-colors ${
                tab === t
                  ? "text-emerald-600 border-b-2 border-emerald-500"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t === "login" ? "Iniciar Sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          )}

          {!loading && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === "register" && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {tab === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
              </button>

              {GOOGLE_CLIENT_ID && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium">o</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-slate-200 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors font-semibold text-slate-700 text-sm"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.49-1.63.8-2.7.8-2.08 0-3.84-1.4-4.47-3.28H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                      <path fill="#FBBC05" d="M4.51 10.57A4.8 4.8 0 0 1 4.26 9c0-.55.09-1.08.25-1.57V5.36H1.83a8 8 0 0 0 0 7.28l2.68-2.07z"/>
                      <path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.36L4.51 7.43c.63-1.89 2.4-3.85 4.47-3.85z"/>
                    </svg>
                    Continuar con Google
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-600 text-center max-w-xs">
        Al continuar, aceptás el uso responsable de tus datos fiscales dentro de TaxFlow.py
      </p>
    </div>
  );
};

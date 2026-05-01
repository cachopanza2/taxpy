import React, { useState, useEffect, useRef } from "react";
import { ScanLine, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthService, AuthUser } from "../services/authService";

interface Props {
  onLogin: (user: AuthUser) => void;
}

export const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleRef = useRef<HTMLDivElement>(null);
  const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  // Initialize Google Sign-In button
  useEffect(() => {
    if (!googleClientId) return;
    let attempts = 0;

    const handleCredential = async (response: { credential: string }) => {
      setLoading(true);
      setError(null);
      try {
        const user = await AuthService.loginWithGoogle(response.credential);
        onLogin(user);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error con Google");
      } finally {
        setLoading(false);
      }
    };

    const tryRender = () => {
      if (window.google?.accounts?.id && googleRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredential,
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: "outline",
          size: "large",
          width: googleRef.current.offsetWidth || 320,
          text: "continue_with",
          locale: "es",
        });
      } else if (attempts < 30) {
        attempts++;
        setTimeout(tryRender, 100);
      }
    };

    tryRender();
  }, [googleClientId, onLogin]);

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
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name (register only) */}
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

          {/* Email */}
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

          {/* Password */}
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

          {/* Error */}
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : tab === "login" ? (
              "Iniciar Sesión"
            ) : (
              "Crear Cuenta"
            )}
          </button>

          {/* Divider */}
          {googleClientId && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">o</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Google button rendered by GIS */}
              <div
                ref={googleRef}
                className="flex justify-center w-full min-h-[44px]"
              />
            </>
          )}
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-600 text-center max-w-xs">
        Al continuar, aceptás el uso responsable de tus datos fiscales dentro de TaxFlow.py
      </p>
    </div>
  );
};

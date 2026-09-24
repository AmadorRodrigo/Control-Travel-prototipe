import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPasswordRequest } from "../services/api";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(location.search).get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);

  useEffect(() => {
    // Keep the token in component memory, out of subsequent URLs and history.
    if (location.search) navigate("/reset-password", { replace: true });
  }, [location.search, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLoading) return;
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    if (!/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password) || !/\p{N}/u.test(password)) {
      setError("A senha deve conter uma letra maiúscula, uma minúscula e um número.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await resetPasswordRequest(token, password);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--color-neutral-900)" }}>
      <section className="card elev-sm" style={{ width: "100%", maxWidth: 460, padding: 32, background: "var(--color-surface)" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 24 }}>Redefinir senha</h1>
        {validToken ? (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <p id="password-policy">Use de 8 a 128 caracteres, incluindo uma letra maiúscula, uma minúscula e um número.</p>
            <div className="field">
              <label htmlFor="reset-password">Nova senha</label>
              <input id="reset-password" className="input" type="password" autoComplete="new-password"
                aria-describedby="password-policy" required minLength={8} maxLength={128}
                value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirmar senha</label>
              <input id="reset-confirm" className="input" type="password" autoComplete="new-password"
                required minLength={8} maxLength={128}
                value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </div>
            {error ? <p role="alert">{error}</p> : null}
            <button className="btn btn-primary btn-block" type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        ) : <p role="alert">Link inválido. Solicite um novo link em “Esqueci minha senha”.</p>}
        <Link to="/login" style={{ display: "inline-block", marginTop: 20 }}>Voltar para entrar</Link>
      </section>
    </main>
  );
}

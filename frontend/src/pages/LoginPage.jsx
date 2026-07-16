import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { login, setup, isAuthenticated, isLoading, user } = useAuth();
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [setupForm, setSetupForm] = useState({ documento: "", email: "", new_password: "", confirm: "" });
  const [errorMessage, setErrorMessage] = useState("");

  if (isAuthenticated) {
    return <Navigate to={user?.is_admin ? "/viagens" : "/minha-poltrona"} replace />;
  }

  function handleLoginChange(e) {
    const { name, value } = e.target;
    setLoginForm((c) => ({ ...c, [name]: value }));
  }

  function handleSetupChange(e) {
    const { name, value } = e.target;
    setSetupForm((c) => ({ ...c, [name]: value }));
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage("");
    try {
      await login(loginForm);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleSetupSubmit(e) {
    e.preventDefault();
    if (isLoading) return;
    if (setupForm.new_password !== setupForm.confirm) {
      setErrorMessage("As senhas não conferem.");
      return;
    }
    setErrorMessage("");
    try {
      await setup({ documento: setupForm.documento, email: setupForm.email, new_password: setupForm.new_password });
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, background: "var(--color-neutral-900)" }}>
      <div style={{
        width: "100%", maxWidth: 960,
        background: "var(--color-surface)",
        display: "grid", gridTemplateColumns: "1.05fr 1fr",
        boxShadow: "var(--shadow-lg)",
        animation: "ct-fade .35s ease",
      }}>
        {/* Left panel */}
        <section style={{
          background: "var(--color-text)", color: "var(--color-bg)",
          padding: "48px 40px",
          display: "flex", flexDirection: "column",
          justifyContent: "space-between", gap: 32,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span className="tag tag-accent" style={{ width: "fit-content" }}>Control Travel</span>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 34, lineHeight: 1.15, margin: 0, fontWeight: 700 }}>
              Controle de viagens, andares e poltronas.
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, opacity: .75, maxWidth: "36ch", margin: 0 }}>
              Cadastro sem venda, alocação de assentos por andar e acompanhamento de embarque — pensado para operação, não para bilheteria.
            </p>
          </div>
          <div style={{ display: "grid", gap: 2, background: "var(--color-divider)" }}>
            <div style={{ background: "var(--color-text)", padding: "16px 0", display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", opacity: .55 }}>Sistema</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Pronto para uso</span>
            </div>
            <div style={{ background: "var(--color-text)", padding: "16px 0", display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", opacity: .55 }}>Assentos</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Por número e andar</span>
            </div>
            <div style={{ background: "var(--color-text)", padding: "16px 0 0", display: "flex", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", opacity: .55 }}>Operação</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Cadastro sem venda</span>
            </div>
          </div>
        </section>

        {/* Right panel */}
        <section style={{ padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
          <div className="seg" role="radiogroup" style={{ width: "100%" }}>
            <label className="seg-opt" style={{ flex: 1, justifyContent: "center" }}>
              <input type="radio" name="login-tab" checked={mode === "login"} onChange={() => { setMode("login"); setErrorMessage(""); }} readOnly />
              Entrar
            </label>
            <label className="seg-opt" style={{ flex: 1, justifyContent: "center" }}>
              <input type="radio" name="login-tab" checked={mode === "setup"} onChange={() => { setMode("setup"); setErrorMessage(""); }} readOnly />
              Primeiro acesso
            </label>
          </div>

          {mode === "login" ? (
            <form style={{ display: "grid", gap: 16 }} onSubmit={handleLoginSubmit}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, margin: 0 }}>Acesse sua conta</h2>
              <div className="field">
                <label htmlFor="ct-username">Usuário ou e-mail</label>
                <input className="input" id="ct-username" type="text" name="username"
                  placeholder="rodrigo.amador" value={loginForm.username} onChange={handleLoginChange} autoComplete="username" required />
              </div>
              <div className="field">
                <label htmlFor="ct-password">Senha</label>
                <input className="input" id="ct-password" type="password" name="password"
                  placeholder="••••••••" value={loginForm.password} onChange={handleLoginChange} autoComplete="current-password" required />
              </div>
              {errorMessage ? (
                <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
                  {errorMessage}
                </div>
              ) : null}
              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar como administrador"}
              </button>
            </form>
          ) : (
            <form style={{ display: "grid", gap: 16 }} onSubmit={handleSetupSubmit}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, margin: 0 }}>Primeiro acesso</h2>
              <p style={{ fontSize: 13, opacity: .6, margin: 0 }}>
                Informe o documento cadastrado pelo administrador, seu e-mail e defina uma senha.
              </p>
              <div className="field">
                <label htmlFor="ct-doc">Documento (RG, CPF ou passaporte)</label>
                <input className="input" id="ct-doc" type="text" name="documento"
                  placeholder="12345678900" value={setupForm.documento} onChange={handleSetupChange} autoComplete="off" required />
              </div>
              <div className="field">
                <label htmlFor="ct-email">Seu e-mail</label>
                <input className="input" id="ct-email" type="email" name="email"
                  placeholder="voce@email.com" value={setupForm.email} onChange={handleSetupChange} autoComplete="email" required />
              </div>
              <div className="field">
                <label htmlFor="ct-pass1">Nova senha</label>
                <input className="input" id="ct-pass1" type="password" name="new_password"
                  placeholder="Mínimo 6 caracteres" value={setupForm.new_password} onChange={handleSetupChange}
                  autoComplete="new-password" required minLength={6} />
              </div>
              <div className="field">
                <label htmlFor="ct-pass2">Confirmar senha</label>
                <input className="input" id="ct-pass2" type="password" name="confirm"
                  placeholder="Repita a senha" value={setupForm.confirm} onChange={handleSetupChange}
                  autoComplete="new-password" required minLength={6} />
              </div>
              {errorMessage ? (
                <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 13 }}>
                  {errorMessage}
                </div>
              ) : null}
              <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
                {isLoading ? "Salvando..." : "Definir senha e ver minha poltrona"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default LoginPage;

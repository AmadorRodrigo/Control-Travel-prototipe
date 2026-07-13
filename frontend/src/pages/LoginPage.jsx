import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { login, setup, isAuthenticated, isLoading, user } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "setup"
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
      await setup({
        documento: setupForm.documento,
        email: setupForm.email,
        new_password: setupForm.new_password,
      });
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-[28px] bg-white shadow-card lg:grid-cols-2">
          <section className="flex flex-col justify-between bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-6 text-white sm:p-8">
            <div className="space-y-4">
              <span className="inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                Mobile First
              </span>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                  Controle viagens, ocupação e alocação com foco em operação.
                </h1>
                <p className="max-w-md text-sm leading-6 text-blue-50 sm:text-base">
                  Acesso rápido para equipes que precisam cadastrar viajantes,
                  distribuir assentos por andar e manter a operação estável em
                  telas pequenas.
                </p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-blue-100">Segurança</p>
                <p className="mt-2 text-sm font-medium">JWT + hash bcrypt</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-blue-100">Assentos</p>
                <p className="mt-2 text-sm font-medium">Poltrona por número e andar</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-blue-100">Operação</p>
                <p className="mt-2 text-sm font-medium">Cadastro sem venda</p>
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-8">
            <div className="mx-auto flex min-h-full max-w-md flex-col justify-center">
              {/* Mode toggle */}
              <div className="mb-6 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setErrorMessage(""); }}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("setup"); setErrorMessage(""); }}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    mode === "setup"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Primeiro acesso
                </button>
              </div>

              {mode === "login" ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Acesse sua conta</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Use seu usuário ou e-mail cadastrado.
                    </p>
                  </div>

                  <form className="space-y-4" onSubmit={handleLoginSubmit}>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Usuário ou e-mail</span>
                      <input
                        className={inputClass}
                        type="text"
                        name="username"
                        autoComplete="username"
                        placeholder="Digite seu usuário ou e-mail"
                        value={loginForm.username}
                        onChange={handleLoginChange}
                        required
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Senha</span>
                      <input
                        className={inputClass}
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="Digite sua senha"
                        value={loginForm.password}
                        onChange={handleLoginChange}
                        required
                      />
                    </label>

                    {errorMessage ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isLoading ? "Entrando..." : "Entrar"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Primeiro acesso</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Informe seu documento (RG, CPF ou passaporte) cadastrado pelo administrador, seu e-mail e defina uma senha. Após confirmar, você verá sua poltrona e viagem.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Já possui conta? Use este formulário com o e-mail cadastrado para redefinir sua senha.
                    </p>
                  </div>

                  <form className="space-y-4" onSubmit={handleSetupSubmit}>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Documento (RG, CPF ou passaporte)</span>
                      <input
                        className={inputClass}
                        type="text"
                        name="documento"
                        autoComplete="off"
                        placeholder="Número do documento cadastrado"
                        value={setupForm.documento}
                        onChange={handleSetupChange}
                        required
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Seu e-mail</span>
                      <input
                        className={inputClass}
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        value={setupForm.email}
                        onChange={handleSetupChange}
                        required
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Nova senha</span>
                      <input
                        className={inputClass}
                        type="password"
                        name="new_password"
                        autoComplete="new-password"
                        placeholder="Mínimo 6 caracteres"
                        value={setupForm.new_password}
                        onChange={handleSetupChange}
                        required
                        minLength={6}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Confirmar senha</span>
                      <input
                        className={inputClass}
                        type="password"
                        name="confirm"
                        autoComplete="new-password"
                        placeholder="Repita a senha"
                        value={setupForm.confirm}
                        onChange={handleSetupChange}
                        required
                        minLength={6}
                      />
                    </label>

                    {errorMessage ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isLoading ? "Salvando..." : "Definir senha e entrar"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;

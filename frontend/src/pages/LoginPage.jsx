import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  username: "",
  password: "",
};

function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [formData, setFormData] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/passageiros" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLoading) {
      return;
    }

    setErrorMessage("");

    try {
      await login(formData);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

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
                <p className="text-xs uppercase tracking-wide text-blue-100">
                  Segurança
                </p>
                <p className="mt-2 text-sm font-medium">JWT + hash bcrypt</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-blue-100">
                  Assentos
                </p>
                <p className="mt-2 text-sm font-medium">
                  Poltrona por número e andar
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-blue-100">
                  Operação
                </p>
                <p className="mt-2 text-sm font-medium">Cadastro sem venda</p>
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-8">
            <div className="mx-auto flex min-h-full max-w-md flex-col justify-center">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
                  Entrar
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  Acesse sua conta
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Interface otimizada para Android e iPhone, priorizando leitura
                  rápida e toque confortável.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Usuário</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                    type="text"
                    name="username"
                    autoComplete="username"
                    placeholder="Digite seu usuário"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">Senha</span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={formData.password}
                    onChange={handleChange}
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

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Use as credenciais padrão definidas no `.env` para o primeiro
                acesso.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;

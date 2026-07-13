import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AppHeader({ title, description }) {
  const { logout, user } = useAuth();

  return (
    <header className="rounded-3xl bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
            Travel Seat Manager
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
          {user ? (
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
              Sessão ativa: {user.username}
              {user.is_admin ? " · Admin" : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user?.is_admin ? (
            <>
              <NavLink
                to="/viagens"
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                Viagens
              </NavLink>
              <NavLink
                to="/passageiros"
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                Passageiros
              </NavLink>
              <NavLink
                to="/usuarios"
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                Usuários
              </NavLink>
              <NavLink
                to="/vinculos"
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                Vínculos
              </NavLink>
            </>
          ) : (
            <NavLink
              to="/minha-poltrona"
              className={({ isActive }) =>
                `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`
              }
            >
              Minha Poltrona
            </NavLink>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;

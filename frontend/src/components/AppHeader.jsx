import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AppHeader() {
  const { logout, user } = useAuth();

  return (
    <nav className="nav">
      <span className="nav-brand">Control Travel</span>

      {user?.is_admin ? (
        <>
          <NavLink to="/viagens" aria-current={undefined}
            className={({ isActive }) => isActive ? undefined : undefined}
            style={({ isActive }) => isActive ? { color: "var(--color-accent)" } : undefined}>
            Viagens
          </NavLink>
          <NavLink to="/passageiros"
            style={({ isActive }) => isActive ? { color: "var(--color-accent)" } : undefined}>
            Passageiros
          </NavLink>
          <NavLink to="/usuarios"
            style={({ isActive }) => isActive ? { color: "var(--color-accent)" } : undefined}>
            Usuários
          </NavLink>
          <NavLink to="/vinculos"
            style={({ isActive }) => isActive ? { color: "var(--color-accent)" } : undefined}>
            Vínculos
          </NavLink>
        </>
      ) : (
        <NavLink to="/minha-poltrona"
          style={({ isActive }) => isActive ? { color: "var(--color-accent)" } : undefined}>
          Minha Poltrona
        </NavLink>
      )}

      <span style={{ flex: 1 }} />

      <button type="button" className="btn btn-ghost" onClick={logout}>
        Sair
      </button>
    </nav>
  );
}

export default AppHeader;

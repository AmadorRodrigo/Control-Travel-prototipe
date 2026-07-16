import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--color-bg)" }}>
        <div className="card elev-sm" style={{ padding: "20px 28px", fontSize: 14 }}>
          Validando sua sessão...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const MySeatsPage = lazy(() => import("./pages/MySeatsPage"));
const PassengersPage = lazy(() => import("./pages/PassengersPage"));
const AssignPage = lazy(() => import("./pages/AssignPage"));
const TripsPage = lazy(() => import("./pages/TripsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

function AdminRoute({ children }) {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--color-bg)" }}>
        <div className="card elev-sm" style={{ padding: "20px 28px", fontSize: 14 }}>
          Validando sua sessão...
        </div>
      </main>
    );
  }

  if (user && !user.is_admin) {
    return <Navigate to="/minha-poltrona" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function SmartRedirect() {
  const { user, isInitializing, isAuthenticated } = useAuth();
  if (isInitializing) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user?.is_admin ? "/viagens" : "/minha-poltrona"} replace />;
}

function App() {
  return (
    <Suspense fallback={<main role="status" style={{ padding: 32 }}>Carregando...</main>}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/viagens"
          element={
            <AdminRoute>
              <TripsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/passageiros"
          element={
            <AdminRoute>
              <PassengersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/vinculos"
          element={
            <AdminRoute>
              <AssignPage />
            </AdminRoute>
          }
        />
        <Route
          path="/minha-poltrona"
          element={
            <ProtectedRoute>
              <MySeatsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<SmartRedirect />} />
      </Routes>
    </Suspense>
  );
}

export default App;

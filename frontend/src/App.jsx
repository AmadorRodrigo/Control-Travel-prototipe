import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import MySeatsPage from "./pages/MySeatsPage";
import PassengersPage from "./pages/PassengersPage";
import AssignPage from "./pages/AssignPage";
import TripsPage from "./pages/TripsPage";
import UsersPage from "./pages/UsersPage";

function AdminRoute({ children }) {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-card">
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
    <Routes>
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
  );
}

export default App;

import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import PassengersPage from "./pages/PassengersPage";
import TripsPage from "./pages/TripsPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/viagens"
        element={
          <ProtectedRoute>
            <TripsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/passageiros"
        element={
          <ProtectedRoute>
            <PassengersPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/viagens" replace />} />
    </Routes>
  );
}

export default App;

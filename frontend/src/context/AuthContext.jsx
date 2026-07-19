import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCurrentUserRequest,
  getStoredAccessToken,
  loginRequest,
  logoutRequest,
  registerAuthChangeListener,
  setupAdminRequest,
  setupRequest,
} from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredAccessToken());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    registerAuthChangeListener((nextToken) => {
      setToken(nextToken);
      if (!nextToken) {
        setUser(null);
      }
    });
  }, []);

  useEffect(() => {
    async function bootstrapSession() {
      if (!token) {
        setIsInitializing(false);
        return;
      }

      try {
        const currentUser = await getCurrentUserRequest();
        setUser(currentUser);
      } catch (error) {
        setUser(null);
      } finally {
        setIsInitializing(false);
      }
    }

    bootstrapSession();
  }, [token]);

  async function login(credentials) {
    setIsLoading(true);
    try {
      const response = await loginRequest(credentials);
      setToken(response.access_token);
      setUser(response.user);
      navigate(response.user.is_admin ? "/viagens" : "/minha-poltrona", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }

  async function setup(credentials) {
    setIsLoading(true);
    try {
      const response = await setupRequest(credentials);
      setToken(response.access_token);
      setUser(response.user);
      navigate("/minha-poltrona", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }

  async function setupAdmin(credentials) {
    setIsLoading(true);
    try {
      const response = await setupAdminRequest(credentials);
      setToken(response.access_token);
      setUser(response.user);
      navigate("/viagens", { replace: true });
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await logoutRequest();
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isLoading,
      isInitializing,
      login,
      setup,
      setupAdmin,
      logout,
    }),
    [token, user, isLoading, isInitializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  }

  return context;
}

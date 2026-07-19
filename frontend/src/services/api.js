const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
export const STORAGE_KEY = "travel-seat-manager:token";

let authChangeListener = null;
let refreshInFlight = null;

function buildQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function registerAuthChangeListener(listener) {
  authChangeListener = listener;
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredAccessToken(token) {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  authChangeListener?.(token || null);
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function doFetch(path, options = {}) {
  const { includeAuth, retryOnAuth, ...fetchOptions } = options;
  const headers = {
    ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}),
    ...(fetchOptions.headers || {}),
  };

  if (includeAuth !== false) {
    const token = getStoredAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...fetchOptions,
    headers,
  });
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await doFetch("/api/auth/refresh", {
        method: "POST",
        includeAuth: false,
      });
      const data = await parseResponse(response);

      if (!response.ok) {
        setStoredAccessToken(null);
        throw new Error(data?.detail || "Sessão expirada. Faça login novamente.");
      }

      setStoredAccessToken(data.access_token);
      return data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function request(path, options = {}) {
  const response = await doFetch(path, options);
  const data = await parseResponse(response);

  if (response.status === 401 && options.retryOnAuth !== false) {
    try {
      await refreshAccessToken();
      const retriedResponse = await doFetch(path, {
        ...options,
        retryOnAuth: false,
      });
      const retriedData = await parseResponse(retriedResponse);

      if (!retriedResponse.ok) {
        throw new Error(retriedData?.detail || "Não foi possível concluir a operação.");
      }

      return retriedData;
    } catch (error) {
      setStoredAccessToken(null);
      throw error;
    }
  }

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((e) => e.msg || JSON.stringify(e)).join("; ")
      : detail || "Não foi possível concluir a operação.";
    throw new Error(message);
  }

  return data;
}

export async function getSetupStatus() {
  return request("/api/auth/setup-status", { method: "GET", includeAuth: false, retryOnAuth: false });
}

export async function setupAdminRequest(payload) {
  const response = await request("/api/auth/setup-admin", {
    method: "POST",
    includeAuth: false,
    retryOnAuth: false,
    body: JSON.stringify(payload),
  });
  setStoredAccessToken(response.access_token);
  return response;
}

export async function loginRequest(payload) {
  const response = await request("/api/auth/login", {
    method: "POST",
    includeAuth: false,
    retryOnAuth: false,
    body: JSON.stringify(payload),
  });
  setStoredAccessToken(response.access_token);
  return response;
}

export async function setupRequest(payload) {
  const response = await request("/api/auth/setup", {
    method: "POST",
    includeAuth: false,
    retryOnAuth: false,
    body: JSON.stringify(payload),
  });
  setStoredAccessToken(response.access_token);
  return response;
}

export async function logoutRequest() {
  try {
    await request("/api/auth/logout", {
      method: "POST",
      retryOnAuth: false,
    });
  } finally {
    setStoredAccessToken(null);
  }
}

export async function getCurrentUserRequest() {
  return request("/api/auth/me", {
    method: "GET",
  });
}

export async function getPassengers(params = {}) {
  return request(`/api/passageiros${buildQueryString(params)}`, {
    method: "GET",
  });
}

export async function createPassenger(payload, idempotencyKey) {
  return request("/api/passageiros", {
    method: "POST",
    headers: {
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  });
}

export async function getUsers() {
  return request("/api/users", { method: "GET" });
}

export async function createUser(payload) {
  return request("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id, payload) {
  return request(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id) {
  return request(`/api/users/${id}`, { method: "DELETE" });
}

export async function getMySeats() {
  return request("/api/me/poltrona", { method: "GET" });
}

export async function updatePassenger(id, payload) {
  return request(`/api/passageiros/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deletePassenger(id) {
  return request(`/api/passageiros/${id}`, {
    method: "DELETE",
  });
}

export async function getTrips(params = {}) {
  return request(`/api/viagens${buildQueryString(params)}`, {
    method: "GET",
  });
}

export async function createTrip(payload) {
  return request("/api/viagens", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTrip(id, payload) {
  return request(`/api/viagens/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getTripSeats(viagemId) {
  return request(`/api/viagens/${viagemId}/assentos`, {
    method: "GET",
  });
}

export async function reserveSeat(viagemId, payload) {
  return request(`/api/viagens/${viagemId}/assentos/reservar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function releaseSeat(viagemId, assentoId) {
  return request(`/api/viagens/${viagemId}/assentos/${assentoId}/reserva`, {
    method: "DELETE",
  });
}

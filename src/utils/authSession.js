
const TOKEN_KEY = "prebotix-access-token-v1";
const REFRESH_KEY = "prebotix-refresh-token-v1";
const USER_KEY = "prebotix-auth-user-v1";

let refreshPromise = null;

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function getStorage() {
  return (
    localStorage.getItem(TOKEN_KEY) !== null ||
    localStorage.getItem(REFRESH_KEY) !== null
  )
    ? localStorage
    : sessionStorage;
}

export function getAccessToken() {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    ""
  );
}

export function getRefreshToken() {
  return (
    localStorage.getItem(REFRESH_KEY) ||
    sessionStorage.getItem(REFRESH_KEY) ||
    ""
  );
}

export function getAuthUser() {
  const rawUser =
    localStorage.getItem(USER_KEY) ||
    sessionStorage.getItem(USER_KEY);

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function saveAuthSession(
  accessToken,
  user,
  rememberMe = false,
  refreshToken = ""
) {
  if (!accessToken || !user || !refreshToken) {
    throw new Error(
      "Access token, refresh token and user information are required."
    );
  }

  clearAuthSession();

  const storage = rememberMe ? localStorage : sessionStorage;

  storage.setItem(TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_KEY, refreshToken);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveAuthUser(user) {
  if (!user || typeof user !== "object") return;

  const storage = getStorage();

  storage.setItem(USER_KEY, JSON.stringify(user));

  window.dispatchEvent(
    new Event("prebotix:user-updated")
  );
}


function updateTokens(accessToken, refreshToken, user = null) {
  const storage = getStorage();

  storage.setItem(TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_KEY, refreshToken);

  if (user && typeof user === "object") {
    storage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  for (const key of [
    TOKEN_KEY,
    REFRESH_KEY,
    USER_KEY,
    "token",
    "jwt",
    "user",
  ]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

function dispatchSessionExpired() {
  window.dispatchEvent(
    new Event("prebotix:session-expired")
  );
}

async function performRefresh(failedAccessToken) {
  // Another request or browser tab may already have refreshed.
  const currentToken = getAccessToken();

  if (currentToken && currentToken !== failedAccessToken) {
    return currentToken;
  }

  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    const error = new Error("Refresh token is missing.");
    error.authExpired = true;
    throw error;
  }

  const response = await fetch(`${API}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    const error = new Error(
      data.message || "Your session has expired. Please log in again."
    );
    error.authExpired = true;
    throw error;
  }

  if (!response.ok) {
    // Server/network problem: do not destroy the user's session.
    throw new Error(
      data.message || `Refresh failed (${response.status}).`
    );
  }

  if (!data.accessToken || !data.refreshToken) {
    throw new Error("Refresh response is incomplete.");
  }

  updateTokens(data.accessToken, data.refreshToken);

  return data.accessToken;
}

async function refreshAccessToken(failedAccessToken) {
  if (refreshPromise) return refreshPromise;

  const runRefresh = async () => {
    // Coordinate refreshes between tabs where Web Locks are supported.
    if (
      getStorage() === localStorage &&
      navigator.locks?.request
    ) {
      return navigator.locks.request(
        "prebotix-auth-refresh",
        () => performRefresh(failedAccessToken)
      );
    }

    return performRefresh(failedAccessToken);
  };

  refreshPromise = runRefresh();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function authFetch(url, options = {}) {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Please log in to continue.");
  }

  const makeRequest = (accessToken) => {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${accessToken}`);

    return fetch(url, {
      ...options,
      headers,
    });
  };

  const response = await makeRequest(token);

  if (response.status !== 401) {
    return response;
  }

  let newToken;

  try {
    newToken = await refreshAccessToken(token);
  } catch (error) {
    if (error.authExpired) {
      clearAuthSession();
      dispatchSessionExpired();
    }

    // Network/500 errors do not automatically log the user out.
    throw error;
  }

  const retryResponse = await makeRequest(newToken);

  if (retryResponse.status === 401) {
    clearAuthSession();
    dispatchSessionExpired();
  }

  return retryResponse;
}

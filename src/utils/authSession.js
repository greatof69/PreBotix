const TOKEN_KEY = "prebotix-access-token-v1";
const REFRESH_KEY = "prebotix-refresh-token-v1";
const USER_KEY = "prebotix-auth-user-v1";

let refreshPromise = null;

function getStorage() {
  return localStorage.getItem(TOKEN_KEY) !== null ||
    localStorage.getItem(REFRESH_KEY) !== null
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
    throw new Error("Access token, refresh token and user information are required.");
  }

  clearAuthSession();

  const storage = rememberMe ? localStorage : sessionStorage;

  storage.setItem(TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_KEY, refreshToken);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

function updateTokens(accessToken, refreshToken) {
  const storage = getStorage();

  storage.setItem(TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_KEY, refreshToken);
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

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      throw new Error("Refresh token is missing.");
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (
      !response.ok ||
      !data.accessToken ||
      !data.refreshToken
    ) {
      throw new Error(data.message || "Session refresh failed.");
    }

    updateTokens(data.accessToken, data.refreshToken);

    return data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function authFetch(url, options = {}) {
  let token = getAccessToken();

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

  let response = await makeRequest(token);

  if (response.status !== 401) {
    return response;
  }

  try {
    token = await refreshAccessToken();
    response = await makeRequest(token);
    return response;
  } catch {
    clearAuthSession();
    window.dispatchEvent(new Event("prebotix:session-expired"));
    return response;
  }
}

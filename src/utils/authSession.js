
const TOKEN_KEY = "prebotix-access-token-v1";
const USER_KEY = "prebotix-auth-user-v1";

export function getAccessToken() {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
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

export function saveAuthSession(accessToken, user, rememberMe = false) {
  if (!accessToken || !user) {
    throw new Error("Access token and user information are required.");
  }

  clearAuthSession();

  const storage = rememberMe ? localStorage : sessionStorage;

  storage.setItem(TOKEN_KEY, accessToken);
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  for (const key of [TOKEN_KEY, USER_KEY, "token", "jwt", "user"]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

export async function authFetch(url, options = {}) {
  const token = getAccessToken();

  if (!token) {
    throw new Error("Please log in to continue.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuthSession();
    window.dispatchEvent(new Event("prebotix:session-expired"));
  }

  return response;
}

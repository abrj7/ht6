import { useAuth0 } from "@auth0/auth0-react";
import { AUTH_CONFIGURED, AUTH0_AUDIENCE } from "./authConfig.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// Prefix bare "/api/..." paths with the backend origin so calls hit :4000
// (Express) instead of :3000 (Vite). Absolute URLs pass through untouched.
function resolveUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function useAuthApi() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  async function fetchAuth(url, options = {}) {
    const headers = { ...(options.headers || {}) };

    // Attach a bearer token only when Auth0 is configured and the user is
    // signed in. In demo mode we send the request unauthenticated — the
    // backend's auth guard is disabled without AUTH0_AUDIENCE/DOMAIN.
    if (AUTH_CONFIGURED && isAuthenticated) {
      try {
        const accessToken = await getAccessTokenSilently({
          authorizationParams: { audience: AUTH0_AUDIENCE || undefined },
        });
        headers.Authorization = `Bearer ${accessToken}`;
      } catch {
        // Token fetch failed (expired session, etc.) — fall through
        // unauthenticated rather than crashing the caller.
      }
    }

    return fetch(resolveUrl(url), { ...options, headers });
  }

  return { fetchAuth };
}

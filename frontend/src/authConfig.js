// Central Auth0 config + a single AUTH_CONFIGURED flag the whole app reads.
// When the SPA Client ID (or domain) is missing, the app runs in DEMO MODE:
// login controls hide, protected calls go out unauthenticated, and the
// backend serves them because its own auth guard is disabled without an
// AUTH0_AUDIENCE/DOMAIN. Nothing crashes on a missing key.

export const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || "";
export const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || "";
export const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || "";

export const AUTH_CONFIGURED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

// Auth0Provider throws if domain/clientId are undefined, so hand it harmless
// placeholders when unconfigured. They are never used for a real redirect
// because AUTH_CONFIGURED gates every login/token call.
export const PROVIDER_DOMAIN = AUTH0_DOMAIN || "placeholder.auth0.com";
export const PROVIDER_CLIENT_ID = AUTH0_CLIENT_ID || "placeholder-client-id";

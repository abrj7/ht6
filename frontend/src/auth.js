import { useAuth0 } from "@auth0/auth0-react";

const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

export function useAuthApi() {
  const { getAccessTokenSilently } = useAuth0();

  async function fetchAuth(url, options = {}) {
    const accessToken = await getAccessTokenSilently({ authorizationParams: { audience } });
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    };
    return fetch(url, { ...options, headers });
  }

  return { fetchAuth };
}

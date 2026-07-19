import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.jsx";
import "./index.css";
import { PROVIDER_DOMAIN, PROVIDER_CLIENT_ID, AUTH0_AUDIENCE } from "./authConfig.js";
import { CurrencyProvider } from "./currency.jsx";

// Always mount the provider (so useAuth0 never throws), but when Auth0 is
// unconfigured it gets placeholder domain/clientId that are never exercised —
// AUTH_CONFIGURED gates every real login/token call. See authConfig.js.
ReactDOM.createRoot(document.getElementById("root")).render(
  <Auth0Provider
    domain={PROVIDER_DOMAIN}
    clientId={PROVIDER_CLIENT_ID}
    authorizationParams={{
      audience: AUTH0_AUDIENCE || undefined,
      redirect_uri: window.location.origin,
    }}
  >
    <CurrencyProvider>
      <App />
    </CurrencyProvider>
  </Auth0Provider>
);

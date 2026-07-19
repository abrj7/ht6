import { useAuth0 } from "@auth0/auth0-react";
import { AUTH_CONFIGURED } from "../authConfig.js";

export default function AuthControls() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    isLoading,
    error,
  } = useAuth0();

  // No Auth0 Client ID wired yet: show a demo-mode chip instead of dead
  // login buttons that would throw on click.
  if (!AUTH_CONFIGURED) {
    return (
      <div className="auth-controls auth-demo" title="Set VITE_AUTH0_CLIENT_ID to enable login">
        Demo mode
      </div>
    );
  }

  const handleLogin = () => loginWithRedirect({ authorizationParams: { screen_hint: "login" } });
  const handleSignup = () => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } });
  const handleLogout = () => logout({ logoutParams: { returnTo: window.location.origin } });

  if (isLoading) {
    return <div className="auth-controls auth-loading">Loading auth…</div>;
  }

  if (error) {
    return <div className="auth-controls auth-error">Auth error: {error.message}</div>;
  }

  if (isAuthenticated) {
    const displayName = user?.name || user?.nickname || user?.email || "Authenticated user";
    const initial = displayName.trim().charAt(0).toUpperCase() || "U";
    return (
      <div className="auth-controls auth-user">
        {user?.picture ? (
          <img
            className="auth-avatar"
            src={user.picture}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="auth-avatar auth-avatar--fallback" aria-hidden="true">
            {initial}
          </span>
        )}
        <div className="auth-details">
          <div className="auth-name">{displayName}</div>
          {user?.email && user.email !== displayName && (
            <div className="auth-email">{user.email}</div>
          )}
        </div>
        <button className="button button--secondary" type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-controls auth-actions">
      <button className="button button--primary" type="button" onClick={handleLogin}>
        Log in
      </button>
      <button className="button button--secondary" type="button" onClick={handleSignup}>
        Sign up
      </button>
    </div>
  );
}

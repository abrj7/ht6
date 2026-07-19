import { useAuth0 } from "@auth0/auth0-react";

export default function AuthControls() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    isLoading,
    error,
  } = useAuth0();

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
    return (
      <div className="auth-controls auth-user">
        {user?.picture && <img className="auth-avatar" src={user.picture} alt={user.name || user.email || "User avatar"} />}
        <div className="auth-details">
          <div className="auth-name">{user?.name || "Authenticated user"}</div>
          {user?.email && <div className="auth-email">{user.email}</div>}
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

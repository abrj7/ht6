import { Component } from "react";

// Catches render/runtime errors in its subtree so a crash shows a readable
// message instead of a blank white screen. Reset clears the error so the user
// can keep going without a full page reload.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface to the console for debugging; UI already shows the message.
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <strong className="error-boundary__title">{this.props.label || "Something broke"}</strong>
          <p className="error-boundary__msg">{String(this.state.error?.message || this.state.error)}</p>
          <button type="button" className="button button--secondary" onClick={this.reset}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

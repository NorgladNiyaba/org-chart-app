import Icon from "./Icon.jsx";

function TopBar({ theme, onToggleTheme }) {
  const isDark = theme === "dark";

  return (
    <nav className="topnav">
      <div className="nav-left">
        <a className="nav-logo" href="/">
          <img
            src="/brand/plexa-one-mark.png"
            alt="Plexa One"
            className="nav-logo-img"
          />
          <span className="nav-wordmark">
            Org <span>Chart</span>
          </span>
        </a>
        <span className="nav-ver">v5.0</span>
      </div>

      <div className="nav-right">
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Icon name={isDark ? "sun" : "moon"} />
        </button>
      </div>
    </nav>
  );
}

export default TopBar;

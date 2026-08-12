import { SEVERITY } from "../lib/buildTree.js";
import Icon from "./Icon.jsx";

const STYLE = {
  [SEVERITY.ERROR]: { className: "alert-error", icon: "alertCircle", title: "Needs attention" },
  [SEVERITY.WARNING]: { className: "alert-warn", icon: "alertTriangle", title: "Worth checking" },
  [SEVERITY.INFO]: { className: "alert-info", icon: "info", title: "For information" },
};

/**
 * Everything the data doesn't say cleanly, shown rather than swallowed. Nobody is
 * removed from the chart because of an issue listed here.
 */
function IssuesPanel({ summary }) {
  const { all, errors, warnings } = summary;

  if (!all.length) {
    return (
      <div className="alert alert-success">
        <span className="alert-icon">
          <Icon name="check" />
        </span>
        <div>
          <span className="alert-title">Data looks clean</span>
          <span className="alert-text">
            Every row has an ID, a name, and a manager we could resolve.
          </span>
        </div>
      </div>
    );
  }

  const headline =
    errors.length > 0
      ? `${errors.length} ${errors.length === 1 ? "problem" : "problems"} to fix`
      : warnings.length > 0
        ? `${warnings.length} ${warnings.length === 1 ? "thing" : "things"} worth checking`
        : "Notes on your data";

  return (
    <div className="issues">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="sub-label" style={{ marginBottom: 0 }}>
          {headline}
        </span>
        <span className="badge badge-neutral badge-pill">
          Everyone is still on the chart
        </span>
      </div>

      {all.map((issue, index) => {
        const style = STYLE[issue.severity];
        return (
          <div key={index} className={`alert ${style.className}`}>
            <span className="alert-icon">
              <Icon name={style.icon} />
            </span>
            <div>
              <span className="alert-title">{style.title}</span>
              <span className="alert-text">{issue.message}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IssuesPanel;

import { useState } from "react";
import Icon from "./Icon.jsx";
import { downloadTemplateCsv, downloadTemplateXlsx } from "../lib/template.js";

/**
 * The routes in that don't involve already having a file: build one by hand,
 * load the worked example, or take a spreadsheet away and fill it in.
 *
 * Both starting options throw away whatever is loaded and reset the undo
 * history, so once there is work to lose they ask first. The confirmation is
 * inline rather than a dialog — it is one decision, and it belongs next to the
 * button that caused it.
 */
function StartOptions({ onStartBlank, onUseSample, peopleCount = 0, compact = false }) {
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(null);

  const hasWork = peopleCount > 0;

  const run = (action) => {
    setConfirming(null);
    action();
  };

  const request = (key, action) => {
    if (!hasWork) {
      action();
      return;
    }
    setConfirming({ key, action });
  };

  const getXlsx = async () => {
    setBusy("xlsx");
    try {
      await downloadTemplateXlsx();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className={`start-options${compact ? " start-options--compact" : ""}`}>
      {!compact && (
        <>
          <span className="sub-label" style={{ marginBottom: 0 }}>
            No file to hand?
          </span>
          <p className="cell-body">
            Start an empty chart and type people in, or load a worked example to see
            how it fits together.
          </p>
        </>
      )}

      {confirming ? (
        <div className="alert alert-warn confirm-inline">
          <span className="alert-icon">
            <Icon name="alertTriangle" />
          </span>
          <div>
            <span className="alert-title">
              Replace the {peopleCount} {peopleCount === 1 ? "person" : "people"} you
              have now?
            </span>
            <span className="alert-text">
              This clears the current chart and cannot be undone.
            </span>
            <div className="row" style={{ marginTop: "var(--s3)" }}>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => run(confirming.action)}
              >
                Replace
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirming(null)}
              >
                Keep what I have
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => request("blank", onStartBlank)}
          >
            <Icon name="plus" />
            Start from scratch
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => request("sample", onUseSample)}
          >
            <Icon name="users" />
            Load sample org
          </button>
        </div>
      )}

      <div className="template-row">
        <span className="template-row__label">Or download a blank template:</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => downloadTemplateCsv()}
        >
          <Icon name="download" />
          CSV
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={getXlsx}
          disabled={busy === "xlsx"}
        >
          <Icon name="download" />
          {busy === "xlsx" ? "Preparing…" : "Excel"}
        </button>
      </div>
    </div>
  );
}

export default StartOptions;

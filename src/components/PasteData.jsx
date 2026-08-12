import { useId, useState } from "react";
import Icon from "./Icon.jsx";

/**
 * The other way in. Copying a block of cells straight out of a spreadsheet is
 * usually faster than exporting a CSV, and tab-separated text is exactly what
 * the clipboard already contains — the parser handles it without any special
 * casing.
 */
function PasteData({ onSubmit }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const id = useId();

  const rowCount = text.trim() ? text.trim().split(/\r?\n/).length - 1 : 0;

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <Icon name="clipboard" />
        Paste from a spreadsheet
      </button>
    );
  }

  return (
    <div className="paste-panel">
      <div className="fl-field">
        <div className="fl-wrap">
          <textarea
            id={id}
            className={`fl-textarea${text ? " filled" : ""}`}
            value={text}
            placeholder=" "
            rows={6}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // Take the clipboard text directly so a big paste lands in one go.
              const pasted = e.clipboardData?.getData("text");
              if (pasted) {
                e.preventDefault();
                setText(pasted);
              }
            }}
          />
          <label className="fl-label" htmlFor={id}>
            Paste rows, including the header
          </label>
          <div className="fl-bar" />
        </div>
        <span className="fl-hint">
          {rowCount > 0
            ? `${rowCount} ${rowCount === 1 ? "row" : "rows"} after the header`
            : "Copy the cells from Excel or Google Sheets and paste here"}
        </span>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary-filled btn-sm"
          onClick={submit}
          disabled={rowCount < 1}
        >
          Use these rows
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setText("");
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default PasteData;

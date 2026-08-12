import { useId } from "react";

function ColumnSelector({ label, required = false, value, onChange, columns, hint }) {
  const id = useId();

  return (
    <div className="fl-field">
      <div className="fl-wrap">
        <select
          id={id}
          className={`fl-select${value ? "" : " is-empty"}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Not mapped</option>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
        <label className="fl-label" htmlFor={id}>
          {label}
          {required && <span className="fl-required">*</span>}
        </label>
        <div className="fl-bar" />
      </div>
      {hint && <span className="fl-hint">{hint}</span>}
    </div>
  );
}

export default ColumnSelector;

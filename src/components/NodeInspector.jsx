import { useId } from "react";
import { ICON_KEYS, ICON_PATHS } from "../lib/chart/roleIcons.js";
import { CATEGORY_COUNT } from "../lib/chart/model.js";
import Icon from "./Icon.jsx";

/**
 * Corrections for one card. Everything here overrides something the app guessed —
 * the icon from the job title, the colour from branch order, the team name from
 * the manager's title — so each control offers a way back to the guess.
 */

function IconSwatch({ name, active, color, onSelect }) {
  const paths = ICON_PATHS[name];
  return (
    <button
      type="button"
      className={`icon-swatch${active ? " is-active" : ""}`}
      onClick={() => onSelect(name)}
      title={name}
      aria-label={name}
      aria-pressed={active}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? color : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </svg>
    </button>
  );
}

function NodeInspector({ card, palette, override, defaultGrouped = true, onChange, onClear, onClose }) {
  const primaryId = useId();
  const secondaryId = useId();

  if (!card) {
    return (
      <div className="inspector inspector--empty">
        <span className="sub-label" style={{ marginBottom: 0 }}>
          Card details
        </span>
        <p className="cell-body" style={{ marginTop: "var(--s2)" }}>
          Select a card in the chart to change its icon, colour or wording.
          Drag a card onto another to change who it reports to.
        </p>
      </div>
    );
  }

  const isTeam = card.kind === "team";
  const activeColor = (palette[card.category ?? "none"] ?? palette.none).mark;
  const hasOverrides = Boolean(override && Object.keys(override).length);

  return (
    <div className="inspector">
      <div className="inspector__head">
        <div style={{ minWidth: 0 }}>
          <span className="sub-label" style={{ marginBottom: 0 }}>
            {isTeam ? "Team card" : "Card details"}
          </span>
          <div className="inspector__title">{isTeam ? card.label : card.primary}</div>
        </div>
        <button type="button" className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>

      <div className="fl-field">
        <div className="fl-wrap">
          <input
            id={primaryId}
            className={`fl-input${(isTeam ? card.label : card.primary) ? " filled" : ""}`}
            value={isTeam ? card.label : card.primary}
            placeholder=" "
            onChange={(e) => onChange({ primary: e.target.value })}
          />
          <label className="fl-label" htmlFor={primaryId}>
            {isTeam ? "Team name" : "Main line"}
          </label>
          <div className="fl-bar" />
        </div>
      </div>

      {!isTeam && (
        <div className="fl-field">
          <div className="fl-wrap">
            <input
              id={secondaryId}
              className={`fl-input${card.secondary ? " filled" : ""}`}
              value={card.secondary}
              placeholder=" "
              onChange={(e) => onChange({ secondary: e.target.value })}
            />
            <label className="fl-label" htmlFor={secondaryId}>
              Second line
            </label>
            <div className="fl-bar" />
          </div>
        </div>
      )}

      <div>
        <span className="sub-label">Colour</span>
        <div className="swatch-row">
          {Array.from({ length: CATEGORY_COUNT }, (_, index) => index + 1).map((slot) => (
            <button
              key={slot}
              type="button"
              className={`colour-swatch${card.category === slot ? " is-active" : ""}`}
              style={{ background: palette[slot].mark }}
              onClick={() => onChange({ category: slot })}
              title={`Colour ${slot}`}
              aria-label={`Colour ${slot}`}
              aria-pressed={card.category === slot}
            />
          ))}
          <button
            type="button"
            className={`colour-swatch${card.category === null ? " is-active" : ""}`}
            style={{ background: palette.none.mark }}
            onClick={() => onChange({ category: null })}
            title="Neutral"
            aria-label="Neutral"
            aria-pressed={card.category === null}
          />
        </div>
      </div>

      <div>
        <span className="sub-label">Icon</span>
        <div className="icon-grid">
          {ICON_KEYS.map((name) => (
            <IconSwatch
              key={name}
              name={name}
              active={card.icon === name}
              color={activeColor}
              onSelect={(value) => onChange({ icon: value })}
            />
          ))}
        </div>
      </div>

      {!isTeam && card.hasChildren && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={override?.grouped ?? defaultGrouped}
            onChange={(e) => onChange({ grouped: e.target.checked })}
          />
          <span className="toggle-track" />
          <span>
            <span className="toggle-text">Group this team</span>
            <span className="toggle-sub" style={{ display: "block" }}>
              Only applies when every report is a leaf
            </span>
          </span>
        </label>
      )}

      {hasOverrides && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          <Icon name="refresh" />
          Reset to detected values
        </button>
      )}
    </div>
  );
}

export default NodeInspector;

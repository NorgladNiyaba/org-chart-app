import { useCallback, useEffect, useId, useMemo, useReducer, useState } from "react";
import { parseCsvFile, parseCsvText } from "./lib/parseCsv.js";
import { readWorkbook, bestSheet } from "./lib/readXlsx.js";
import { buildTree, summariseIssues, SEVERITY } from "./lib/buildTree.js";
import { autoMapColumns } from "./lib/autoMap.js";
import { exportChartToPdf } from "./lib/chart/exportPdf.js";
import { historyReducer, initialState } from "./state/documentReducer.js";
import {
  TEMPLATE_COLUMNS,
  blankRows,
  templateRowObjects,
} from "./lib/template.js";
import { useTheme } from "./hooks/useTheme.js";
import { useReveal } from "./hooks/useReveal.js";
import { useChartLayout, useElementWidth } from "./hooks/useChartLayout.js";
import ChartSvg from "./components/ChartSvg.jsx";
import ColumnSelector from "./components/ColumnSelector.jsx";
import FileDrop from "./components/FileDrop.jsx";
import Icon from "./components/Icon.jsx";
import IssuesPanel from "./components/IssuesPanel.jsx";
import NodeInspector from "./components/NodeInspector.jsx";
import PasteData from "./components/PasteData.jsx";
import PeopleTable from "./components/PeopleTable.jsx";
import StartOptions from "./components/StartOptions.jsx";
import TopBar from "./components/TopBar.jsx";

/** Below this the type gets too small to read; the paper scrolls instead. */
const MIN_FIT_SCALE = 0.4;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function App() {
  const [history, dispatch] = useReducer(historyReducer, initialState);
  const doc = history.present;

  // View state — deliberately outside the document, so undo never rewinds a
  // scroll position or a search box.
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [zoom, setZoom] = useState("fit");
  const [groupTeams, setGroupTeams] = useState(true);
  const [roleFirst, setRoleFirst] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [sheets, setSheets] = useState(null);
  const [activeSheet, setActiveSheet] = useState("");

  const companyId = useId();
  const { theme, toggleTheme } = useTheme();

  const loadTable = useCallback((parsed, fileName) => {
    const { mapping } = autoMapColumns(parsed.columns);
    dispatch({
      type: "load-data",
      rows: parsed.rows,
      columns: parsed.columns,
      mapping,
      warnings: parsed.warnings,
      fileName,
    });
    setSelectedId(null);
    setCollapsed({});
  }, []);

  const startFrom = useCallback((rows, label) => {
    dispatch({
      type: "start-blank",
      columns: TEMPLATE_COLUMNS,
      rows,
      mapping: {
        id: "Employee ID",
        managerId: "Manager ID",
        name: "Name",
        title: "Job Title",
      },
      label,
    });
    setSelectedId(null);
    setCollapsed({});
    setError("");
  }, []);

  const handleStartBlank = () => {
    setSheets(null);
    startFrom(blankRows(), "Built by hand");
  };
  const handleUseSample = () => {
    setSheets(null);
    startFrom(templateRowObjects(), "Sample org");
  };

  const handleDataFile = async (file) => {
    setError("");
    setSheets(null);

    const isWorkbook = /\.xlsx$/i.test(file.name);

    try {
      if (isWorkbook) {
        const { sheets: parsedSheets } = await readWorkbook(file);
        const withRows = parsedSheets.filter((sheet) => sheet.rows.length);

        if (!withRows.length) {
          setError("Every sheet in that workbook is empty.");
          return;
        }

        // Workbooks often open on a cover tab, so offer the choice rather than
        // silently reading whichever sheet happens to be first.
        if (withRows.length > 1) setSheets({ fileName: file.name, list: withRows });

        const sheet = bestSheet(withRows);
        setActiveSheet(sheet.name);
        loadTable(sheet, `${file.name}${withRows.length > 1 ? ` · ${sheet.name}` : ""}`);
        return;
      }

      const parsed = await parseCsvFile(file);
      if (!parsed.rows.length) {
        setError("That file has a header but no rows.");
        return;
      }
      loadTable(parsed, file.name);
    } catch (e) {
      console.error(e);
      setError(e.message || "We couldn't read that file. Please try another one.");
    }
  };

  const handleSheetChange = (name) => {
    const sheet = sheets?.list.find((item) => item.name === name);
    if (!sheet) return;
    setActiveSheet(name);
    loadTable(sheet, `${sheets.fileName} · ${name}`);
  };

  const handlePaste = (text) => {
    setError("");
    try {
      const parsed = parseCsvText(text);
      if (!parsed.rows.length) {
        setError("That paste didn't contain any rows below the header.");
        return;
      }
      loadTable(parsed, "Pasted data");
    } catch (e) {
      console.error(e);
      setError("We couldn't read that pasted data.");
    }
  };

  const handleLogoFile = (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload a logo image.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        dispatch({
          type: "set-logo",
          logoDataUrl: reader.result,
          logoFileName: file.name,
        });
      }
    };
    reader.onerror = () => setError("We couldn't read that logo file.");
    reader.readAsDataURL(file);
  };

  // Pure derivation — no state updates during render.
  const tree = useMemo(() => buildTree(doc.rows, doc.mapping), [doc.rows, doc.mapping]);

  const summary = useMemo(() => {
    const csvIssues = doc.parseWarnings.map((message) => ({
      type: "csv-warning",
      severity: SEVERITY.WARNING,
      rowNumber: null,
      personId: "",
      personName: "",
      message,
    }));
    return summariseIssues([...csvIssues, ...tree.issues]);
  }, [doc.parseWarnings, tree.issues]);

  const { model, layout, palette, descendants } = useChartLayout(tree.roots, {
    groupTeams,
    roleFirst,
    overrides: doc.overrides,
    collapsed,
  });

  const [paperRef, paperWidth] = useElementWidth();

  const hasRows = doc.rows.length > 0;
  const hasMappings = Boolean(doc.mapping.name && doc.mapping.id);
  const canExport = tree.roots.length > 0 && hasMappings;
  const mappedCount = Object.values(doc.mapping).filter(Boolean).length;
  const chartTitle = doc.companyName
    ? `${doc.companyName} — Organizational Chart`
    : "Organizational Chart";

  const fitScale = useMemo(() => {
    if (!layout.width || !paperWidth) return 1;
    return Math.max(MIN_FIT_SCALE, Math.min(1, paperWidth / layout.width));
  }, [layout.width, paperWidth]);

  const scale = zoom === "fit" ? fitScale : zoom;
  const selectedCard = layout.cards.find((card) => card.id === selectedId) ?? null;
  const teamCards = layout.cards.filter((card) => card.kind === "team").length;

  const matchCount = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    return layout.cards.filter((card) => {
      const text =
        card.kind === "team"
          ? [card.label, ...card.members.map((m) => `${m.name} ${m.title}`)].join(" ")
          : `${card.primary} ${card.secondary}`;
      return text.toLowerCase().includes(query);
    }).length;
  }, [layout.cards, searchQuery]);

  useReveal([hasRows, hasMappings, tree.roots.length]);

  // Undo/redo from the keyboard, ignoring keystrokes aimed at a text field.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const canDrop = useCallback(
    (source, target) => {
      if (!doc.mapping.managerId) return false;
      if (target.kind !== "person" || !target.sourceId) return false;
      if (target.id === source.id) return false;
      // A card can never report into its own subtree.
      return !descendants.get(source.id)?.has(target.id);
    },
    [descendants, doc.mapping.managerId]
  );

  const handleReparent = (source, target) => {
    dispatch({
      type: "reparent",
      rowIndexes: source.rowIndexes ?? [source.rowIndex],
      managerId: target.sourceId,
    });
    setSelectedId(source.id);
  };

  const toggleCollapse = (id) =>
    setCollapsed((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });

  const stepZoom = (direction) => {
    const current = scale;
    const next =
      direction > 0
        ? ZOOM_STEPS.find((step) => step > current + 0.01)
        : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01);
    if (next) setZoom(next);
  };

  const status = !hasRows
    ? { badge: "badge-neutral", label: "Waiting for a file" }
    : !hasMappings
      ? { badge: "badge-info", label: "Map the columns" }
      : summary.errors.length > 0
        ? { badge: "badge-warn", label: `${summary.errors.length} to fix` }
        : { badge: "badge-success", label: "Ready to export" };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    setError("");
    try {
      const slug = (doc.companyName || "org").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await exportChartToPdf({
        model,
        palette,
        title: chartTitle,
        logoDataUrl: doc.logoDataUrl,
        fileName: `${slug.replace(/^-|-$/g, "") || "org"}-chart.pdf`,
      });
    } catch (e) {
      console.error(e);
      setError(`We couldn't generate the PDF. ${e.message ?? ""}`.trim());
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <TopBar theme={theme} onToggleTheme={toggleTheme} />

      <div className="page">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="bento reveal">
          <div
            className="cell cell-pad-xl b8 reveal-child"
            style={{ minHeight: 220, display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <span className="cell-tag">Sparing Consulting · Org Chart</span>
            <h1 className="cell-title-xl">
              Client-ready charts,
              <br />
              <em>built from your file.</em>
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.7, marginTop: "var(--s4)" }}>
              Upload a spreadsheet, paste a table, or type people in directly — then
              export a chart you can put in front of a client.
            </p>
          </div>

          <div className="cell cell-pad b4 reveal-child" style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="sub-label" style={{ marginBottom: 0 }}>
                Status
              </span>
              <span className={`badge ${status.badge} badge-pill`}>{status.label}</span>
            </div>
            <div>
              <span className="hero-num">{doc.rows.length}</span>
              <span className="hero-num-label">People in file</span>
            </div>
            <div>
              <span className="hero-num hero-num-sm">
                {hasMappings ? `${tree.stats.placed} placed · ${tree.stats.roots} at top` : "—"}
              </span>
              <span className="hero-num-label">Chart</span>
            </div>
            <div>
              <span className="hero-num hero-num-sm">{mappedCount} of 4</span>
              <span className="hero-num-label">Columns mapped</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bento">
            <div className="b12">
              <div className="alert alert-error">
                <span className="alert-icon">
                  <Icon name="alertCircle" />
                </span>
                <div>
                  <span className="alert-title">Something went wrong</span>
                  <span className="alert-text">{error}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Setup ────────────────────────────────────────────── */}
        <div className="section-break reveal">
          <div className="section-break-line" />
          <span className="section-break-num">01</span>
          <span className="section-break-label">Set up</span>
          <div className="section-break-line" />
        </div>

        <div className="bento reveal">
          <div className="cell cell-pad b5 reveal-child">
            <span className="cell-tag">Branding</span>
            <h2 className="cell-title cell-title-sm">Company details</h2>
            <p className="cell-body mb4">
              These appear in the chart header and on the exported PDF.
            </p>

            <div className="col">
              <div className="fl-field">
                <div className="fl-wrap">
                  <input
                    id={companyId}
                    type="text"
                    className={`fl-input${doc.companyName ? " filled" : ""}`}
                    value={doc.companyName}
                    onChange={(e) =>
                      dispatch({ type: "set-branding", companyName: e.target.value })
                    }
                    placeholder=" "
                    autoComplete="organization"
                  />
                  <label className="fl-label" htmlFor={companyId}>
                    Company name
                  </label>
                  <div className="fl-bar" />
                </div>
              </div>

              <FileDrop
                accept="image/*"
                icon="building"
                title="Add a logo"
                hint="PNG or JPG gives the clearest export"
                fileName={doc.logoFileName}
                onFile={handleLogoFile}
              />

              {doc.logoDataUrl && (
                <div className="logo-row">
                  <img src={doc.logoDataUrl} alt="Company logo preview" className="logo-preview" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      dispatch({ type: "set-logo", logoDataUrl: "", logoFileName: "" })
                    }
                  >
                    <Icon name="x" />
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="cell cell-pad b7 reveal-child">
            <span className="cell-tag">Data</span>
            <h2 className="cell-title cell-title-sm">Team file</h2>
            <p className="cell-body mb4">
              One row per person. Excel workbooks, or CSV with commas, semicolons or tabs.
            </p>

            <FileDrop
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              icon="upload"
              title="Drop your CSV or Excel file here"
              hint="or click to choose a file"
              fileName={doc.csvFileName}
              onFile={handleDataFile}
            />

            {sheets && (
              <div className="sheet-picker">
                <Icon name="grid" />
                <span className="sheet-picker__label">
                  {sheets.list.length} sheets in this workbook — reading
                </span>
                <select
                  className="sheet-picker__select"
                  value={activeSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  aria-label="Sheet to read"
                >
                  {sheets.list.map((sheet) => (
                    <option key={sheet.name} value={sheet.name}>
                      {sheet.name} ({sheet.rows.length} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginTop: "var(--s3)" }}>
              <PasteData onSubmit={handlePaste} />
            </div>

            <StartOptions
              compact={hasRows}
              peopleCount={doc.rows.length}
              onStartBlank={handleStartBlank}
              onUseSample={handleUseSample}
            />

            {hasRows && (
              <>
                <div className="row" style={{ justifyContent: "space-between", marginTop: "var(--s6)" }}>
                  <span className="sub-label" style={{ marginBottom: 0 }}>
                    Columns
                  </span>
                  <span className="badge badge-info badge-pill">
                    {mappedCount} matched automatically
                  </span>
                </div>
                <p className="fl-hint" style={{ margin: "var(--s2) 0 var(--s3)" }}>
                  We matched these from your headers — change any that look wrong.
                </p>
                <div className="g2">
                  <ColumnSelector
                    label="Name"
                    required
                    value={doc.mapping.name}
                    onChange={(value) => dispatch({ type: "set-mapping", field: "name", value })}
                    columns={doc.columns}
                  />
                  <ColumnSelector
                    label="Employee ID"
                    required
                    value={doc.mapping.id}
                    onChange={(value) => dispatch({ type: "set-mapping", field: "id", value })}
                    columns={doc.columns}
                  />
                  <ColumnSelector
                    label="Title"
                    value={doc.mapping.title}
                    onChange={(value) => dispatch({ type: "set-mapping", field: "title", value })}
                    columns={doc.columns}
                  />
                  <ColumnSelector
                    label="Manager ID"
                    value={doc.mapping.managerId}
                    onChange={(value) =>
                      dispatch({ type: "set-mapping", field: "managerId", value })
                    }
                    columns={doc.columns}
                    hint="Leave unmapped for a flat list"
                  />
                </div>
                {!hasMappings && (
                  <p className="fl-hint" style={{ marginTop: "var(--s3)" }}>
                    Name and Employee ID are required to build the chart.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Chart ────────────────────────────────────────────── */}
        <div className="section-break reveal">
          <div className="section-break-line" />
          <span className="section-break-num">02</span>
          <span className="section-break-label">Chart</span>
          <div className="section-break-line" />
        </div>

        <div className="bento reveal">
          <div className={`cell cell-pad ${hasRows && hasMappings ? "b8" : "b12"} reveal-child`}>
            <div className="preview-bar">
              <div>
                <span className="cell-tag">Preview</span>
                <h2 className="cell-title cell-title-sm" style={{ marginBottom: 0 }}>
                  {chartTitle}
                </h2>
              </div>

              <div className="preview-bar__controls">
                <button
                  className="btn btn-primary-filled"
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={!canExport || isExporting}
                >
                  <Icon name="download" />
                  {isExporting ? "Preparing…" : "Export PDF"}
                </button>
              </div>
            </div>

            {!hasRows && (
              <div className="empty">
                <div className="empty__title">No chart yet</div>
                <p className="empty__body">
                  Upload a file, paste a table, or start from scratch above.
                </p>
              </div>
            )}

            {hasRows && !hasMappings && (
              <div className="empty">
                <div className="empty__title">Almost there</div>
                <p className="empty__body">
                  Map the Name and Employee ID columns to build the chart.
                </p>
              </div>
            )}

            {hasRows && hasMappings && (
              <>
                <div className="chart-toolbar">
                  <div className="chart-search">
                    <Icon name="search" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Find a person or team"
                      aria-label="Search the chart"
                    />
                  </div>

                  {matchCount !== null && (
                    <span className="badge badge-neutral badge-pill">
                      {matchCount} {matchCount === 1 ? "match" : "matches"}
                    </span>
                  )}

                  <div className="push-right row" style={{ gap: "var(--s1)" }}>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => dispatch({ type: "undo" })}
                      disabled={!history.past.length}
                      title="Undo (Ctrl+Z)"
                      aria-label="Undo"
                    >
                      <Icon name="undo" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => dispatch({ type: "redo" })}
                      disabled={!history.future.length}
                      title="Redo (Ctrl+Shift+Z)"
                      aria-label="Redo"
                    >
                      <Icon name="redo" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => stepZoom(-1)}
                      title="Zoom out"
                      aria-label="Zoom out"
                    >
                      <Icon name="zoomOut" />
                    </button>
                    <span className="zoom-readout">{Math.round(scale * 100)}%</span>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => stepZoom(1)}
                      title="Zoom in"
                      aria-label="Zoom in"
                    >
                      <Icon name="zoomIn" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-icon btn-sm"
                      onClick={() => setZoom("fit")}
                      title="Fit to width"
                      aria-label="Fit to width"
                    >
                      <Icon name="maximize" />
                    </button>
                  </div>
                </div>

                <div className="chart-paper" ref={paperRef}>
                  <div className="chart-head">
                    {doc.logoDataUrl && (
                      <img src={doc.logoDataUrl} alt="" className="chart-head__logo" />
                    )}
                    <div className="chart-head__title">{chartTitle}</div>
                  </div>
                  <div className="chart-body">
                    <ChartSvg
                      layout={layout}
                      palette={palette}
                      scale={scale}
                      interactive
                      selectedId={selectedId}
                      searchQuery={searchQuery}
                      onSelect={(card) => setSelectedId(card.id)}
                      onToggleCollapse={toggleCollapse}
                      onReparent={handleReparent}
                      canDrop={canDrop}
                    />
                  </div>
                </div>

                <div className="chart-meta">
                  <div className="chart-toggles">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={groupTeams}
                        onChange={(e) => setGroupTeams(e.target.checked)}
                      />
                      <span className="toggle-track" />
                      <span>
                        <span className="toggle-text">Group teams</span>
                        <span className="toggle-sub" style={{ display: "block" }}>
                          Collapse leaf reports into one card
                        </span>
                      </span>
                    </label>

                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={roleFirst}
                        onChange={(e) => setRoleFirst(e.target.checked)}
                      />
                      <span className="toggle-track" />
                      <span>
                        <span className="toggle-text">Role first</span>
                        <span className="toggle-sub" style={{ display: "block" }}>
                          Title in bold, name beneath
                        </span>
                      </span>
                    </label>
                  </div>

                  <span>
                    {layout.cards.length} cards
                    {teamCards > 0 && ` · ${teamCards} grouped`}
                    {Object.keys(collapsed).length > 0 &&
                      ` · ${Object.keys(collapsed).length} collapsed`}
                  </span>
                </div>
              </>
            )}
          </div>

          {hasRows && hasMappings && (
            <div className="cell cell-pad b4 reveal-child">
              <NodeInspector
                card={selectedCard}
                palette={palette}
                override={selectedCard ? doc.overrides[selectedCard.id] : null}
                defaultGrouped={groupTeams}
                onChange={(patch) =>
                  dispatch({ type: "set-override", id: selectedCard.id, patch })
                }
                onClear={() => dispatch({ type: "clear-override", id: selectedCard.id })}
                onClose={() => setSelectedId(null)}
                onAddReport={(card) =>
                  dispatch({ type: "add-row", managerId: card.sourceId })
                }
              />
            </div>
          )}
        </div>

        {/* ── Data review ──────────────────────────────────────── */}
        {hasRows && hasMappings && (
          <>
            <div className="section-break reveal">
              <div className="section-break-line" />
              <span className="section-break-num">03</span>
              <span className="section-break-label">Review</span>
              <div className="section-break-line" />
            </div>

            <div className="bento reveal">
              <div className="cell cell-pad b12 reveal-child">
                <span className="cell-tag">Data quality</span>
                <h2 className="cell-title cell-title-sm">What we found</h2>
                <p className="cell-body mb4">
                  Every row in your file is on the chart. These notes explain where the
                  unclear ones were placed.
                </p>
                <IssuesPanel summary={summary} />
              </div>

              <div className="b12 reveal-child">
                <PeopleTable
                  rows={doc.rows}
                  mapping={doc.mapping}
                  onCellChange={(rowIndex, field, value) =>
                    dispatch({ type: "edit-cell", rowIndex, field, value })
                  }
                  onAddRow={() => dispatch({ type: "add-row" })}
                  onDeleteRow={(rowIndex) =>
                    dispatch({ type: "delete-rows", rowIndexes: [rowIndex] })
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default App;

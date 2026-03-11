import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

function App() {
  const [rawRows, setRawRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [nameColumn, setNameColumn] = useState("");
  const [titleColumn, setTitleColumn] = useState("");
  const [idColumn, setIdColumn] = useState("");
  const [managerIdColumn, setManagerIdColumn] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [error, setError] = useState("");
  const [chartTheme, setChartTheme] = useState("classic");
  const chartRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { data, errors, meta } = results;

        if (!data || data.length === 0) {
          setError("This CSV looks empty.");
          return;
        }

        if (errors && errors.length > 0) {
          console.warn("PapaParse warnings:", errors);
        }

        let finalData = data;
        let finalColumns =
          meta && Array.isArray(meta.fields) && meta.fields.length
            ? meta.fields
            : Object.keys(data[0]);

        if (
          finalColumns.length === 1 &&
          typeof finalColumns[0] === "string" &&
          finalColumns[0].includes(",")
        ) {
          const combinedHeader = finalColumns[0];
          const headerParts = combinedHeader.split(",").map((h) => h.trim());

          finalColumns = headerParts;

          finalData = data.map((row) => {
            const onlyKey = combinedHeader;
            const rawValue = row[onlyKey] != null ? String(row[onlyKey]) : "";
            const values = rawValue.split(",");

            const obj = {};
            headerParts.forEach((h, idx) => {
              obj[h] = values[idx] != null ? values[idx].trim() : "";
            });
            return obj;
          });
        }

        setColumns(finalColumns);
        setRawRows(finalData);
        setNameColumn("");
        setTitleColumn("");
        setIdColumn("");
        setManagerIdColumn("");
      },
      error: (err) => {
        console.error("PapaParse error:", err);
        setError("We couldn't read that file. Please try another CSV.");
      },
    });
  };

  const handleLogoChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a logo image.");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setLogoDataUrl(result);
      }
    };
    reader.onerror = () => {
      console.error("Failed to read logo file");
      setError("We couldn't read that logo file.");
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoDataUrl("");
  };

  const rootNodes = useMemo(() => {
    if (!rawRows.length || !nameColumn || !idColumn) {
      return [];
    }

    try {
      const nodeMap = new Map();

      rawRows.forEach((row, index) => {
        const id = String(row[idColumn] || "").trim();
        const name = String(row[nameColumn] || "").trim();
        const title = titleColumn ? String(row[titleColumn] || "").trim() : "";
        const managerId = managerIdColumn
          ? String(row[managerIdColumn] || "").trim() || null
          : null;

        if (!id) {
          console.warn(`Row ${index + 1} has no ID and will be ignored.`);
          return;
        }
        if (!name) {
          console.warn(`Row ${index + 1} has no Name and will be ignored.`);
          return;
        }

        nodeMap.set(id, {
          id,
          name,
          title,
          managerId,
          children: [],
        });
      });

      const roots = [];

      nodeMap.forEach((node) => {
        if (node.managerId && nodeMap.has(node.managerId)) {
          const parent = nodeMap.get(node.managerId);
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      });

      return roots;
    } catch (e) {
      console.error(e);
      setError("We couldn't build the chart from this data.");
      return [];
    }
  }, [rawRows, nameColumn, titleColumn, idColumn, managerIdColumn]);

  const hasMappings = useMemo(
    () => Boolean(nameColumn && idColumn),
    [nameColumn, idColumn]
  );

  const peopleCount = rawRows.length;
  const readyToBuild = rawRows.length > 0 && hasMappings;
  const canExport = rootNodes.length > 0 && hasMappings;
  const mappedCount = [nameColumn, idColumn, titleColumn, managerIdColumn].filter(
    Boolean
  ).length;
  const completionLabel = !rawRows.length
    ? "Start with your company details and CSV file."
    : !hasMappings
      ? "Match the right columns to continue."
      : !rootNodes.length
        ? "Review the data to make sure each person has a name and unique ID."
        : "Your chart is ready to review and export.";

  const handleCellChange = (rowIndex, fieldType, value) => {
    setRawRows((prev) => {
      const next = [...prev];
      const currentRow = { ...next[rowIndex] };

      let columnKey = null;
      if (fieldType === "id") columnKey = idColumn;
      if (fieldType === "name") columnKey = nameColumn;
      if (fieldType === "title") columnKey = titleColumn;
      if (fieldType === "manager") columnKey = managerIdColumn;

      if (!columnKey) return prev;

      currentRow[columnKey] = value;
      next[rowIndex] = currentRow;
      return next;
    });
  };

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    try {
      let logoImg = null;
      if (logoDataUrl) {
        logoImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = logoDataUrl;
        });
      }

      const chartElement = chartRef.current;
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
      });
      const imageData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const bottomMargin = 40;
      const sideMargin = 40;

      let headerTop = 24;
      let headerBottom = headerTop;

      if (logoImg) {
        const maxLogoWidth = 80;
        const maxLogoHeight = 80;
        const imgW = logoImg.width;
        const imgH = logoImg.height;
        const logoRatio = Math.min(maxLogoWidth / imgW, maxLogoHeight / imgH);
        const logoDrawWidth = imgW * logoRatio;
        const logoDrawHeight = imgH * logoRatio;
        const logoX = (pageWidth - logoDrawWidth) / 2;
        const logoY = headerTop;

        pdf.addImage(
          logoDataUrl,
          "PNG",
          logoX,
          logoY,
          logoDrawWidth,
          logoDrawHeight
        );

        headerBottom = logoY + logoDrawHeight;
      }

      const titleText = companyName
        ? `${companyName} Organizational Chart`
        : "Organizational Chart";

      const titleY = headerBottom + 24;
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(titleText, pageWidth / 2, titleY, { align: "center" });

      const topMargin = titleY + 22;
      const maxWidth = pageWidth - sideMargin * 2;
      const maxHeight = pageHeight - topMargin - bottomMargin;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
      const printWidth = imgWidth * ratio;
      const printHeight = imgHeight * ratio;
      const x = (pageWidth - printWidth) / 2;
      const y = topMargin;

      pdf.addImage(imageData, "PNG", x, y, printWidth, printHeight);
      pdf.save("org-chart.pdf");
    } catch (e) {
      console.error(e);
      setError("We couldn't generate the PDF.");
    }
  };

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero__brand">
          <div>
            <p className="eyebrow">Sparing Consulting</p>
            <h1 className="hero__title">Create a clean, client-ready org chart.</h1>
            <p className="hero__copy">
              Add your company details, upload your team file, and export a polished
              chart that is easy to share.
            </p>
          </div>
        </div>

        <div className="hero__summary" aria-label="Chart summary">
          <div className="summary-chip">
            <span className="summary-chip__label">People</span>
            <strong>{peopleCount}</strong>
          </div>
          <div className="summary-chip">
            <span className="summary-chip__label">Mapped fields</span>
            <strong>{mappedCount} of 4</strong>
          </div>
          <div className="summary-chip summary-chip--status">
            <span className="summary-chip__label">Status</span>
            <strong>{completionLabel}</strong>
          </div>
        </div>
      </header>

      <main className="shell-main">
        <div className="workspace">
          <section className="workflow">
            <article className="card section-card">
              <div className="section-heading">
                <div>
                  <span className="section-step">Step 1</span>
                  <h2 className="section-title">Company details</h2>
                </div>
                <p className="section-copy">
                  Add the company name and logo that should appear on the chart.
                </p>
              </div>

              <div className="company-grid">
                <div className="field">
                  <label htmlFor="companyName" className="label">
                    Company name
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    className="input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corporation"
                  />
                </div>

                <div className="field">
                  <label htmlFor="companyLogo" className="label">
                    Logo
                  </label>
                  <input
                    id="companyLogo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="input-file"
                  />
                  <p className="field-note">Use a PNG or JPG for the clearest export.</p>
                  {logoDataUrl && (
                    <div className="logo-preview-wrapper">
                      <img
                        src={logoDataUrl}
                        alt="Company logo preview"
                        className="logo-preview"
                      />
                      <button
                        type="button"
                        className="btn-link"
                        onClick={clearLogo}
                      >
                        Remove logo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>

            <article className="card section-card">
              <div className="section-heading">
                <div>
                  <span className="section-step">Step 2</span>
                  <h2 className="section-title">Upload your team file</h2>
                </div>
                <p className="section-copy">
                  Import a CSV that includes each person's name, unique ID, and manager.
                </p>
              </div>

              <div className="upload-panel">
                <div className="field stack-sm">
                  <label className="label" htmlFor="peopleCsv">
                    Team CSV
                  </label>
                  <input
                    id="peopleCsv"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="input-file"
                  />
                  <p className="field-note">
                    Typical columns include ID, Manager ID, Name, and Title.
                  </p>
                  {rawRows.length > 0 && (
                    <div className="upload-stats">
                      <span className="pill pill-soft">{rawRows.length} rows loaded</span>
                      <span className="text-muted text-small">
                        Match the columns below to build the chart.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mapping-grid">
                <ColumnSelector
                  label="Name"
                  required
                  value={nameColumn}
                  onChange={setNameColumn}
                  columns={columns}
                />
                <ColumnSelector
                  label="Title"
                  value={titleColumn}
                  onChange={setTitleColumn}
                  columns={columns}
                />
                <ColumnSelector
                  label="Employee ID"
                  required
                  value={idColumn}
                  onChange={setIdColumn}
                  columns={columns}
                />
                <ColumnSelector
                  label="Manager ID"
                  value={managerIdColumn}
                  onChange={setManagerIdColumn}
                  columns={columns}
                />
              </div>
              {!hasMappings && rawRows.length > 0 && (
                <p className="text-error">
                  Select a name column and an employee ID column to continue.
                </p>
              )}
            </article>

            <article className="card section-card">
              <div className="section-heading section-heading--compact">
                <div>
                  <span className="section-step">Step 3</span>
                  <h2 className="section-title">Review the people list</h2>
                </div>
                <p className="section-copy">
                  Make quick edits before you save or export the final chart.
                </p>
              </div>

              {rawRows.length === 0 ? (
                <p className="text-muted">Upload your CSV to review the people list.</p>
              ) : !hasMappings ? (
                <p className="text-muted">
                  Match the required columns above to edit the list.
                </p>
              ) : (
                <>
                  <p className="field-note">
                    Changes made here update the chart immediately.
                  </p>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Manager ID</th>
                          <th>Name</th>
                          <th>Title</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rawRows.map((row, index) => {
                          const idValue = idColumn ? String(row[idColumn] ?? "") : "";
                          const managerValue = managerIdColumn
                            ? String(row[managerIdColumn] ?? "")
                            : "";
                          const nameValue = nameColumn
                            ? String(row[nameColumn] ?? "")
                            : "";
                          const titleValue = titleColumn
                            ? String(row[titleColumn] ?? "")
                            : "";

                          return (
                            <tr key={index}>
                              <td>
                                <input
                                  className="cell-input"
                                  value={idValue}
                                  onChange={(e) =>
                                    handleCellChange(index, "id", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="cell-input"
                                  value={managerValue}
                                  onChange={(e) =>
                                    handleCellChange(index, "manager", e.target.value)
                                  }
                                  disabled={!managerIdColumn}
                                  placeholder={!managerIdColumn ? "-" : ""}
                                />
                              </td>
                              <td>
                                <input
                                  className="cell-input"
                                  value={nameValue}
                                  onChange={(e) =>
                                    handleCellChange(index, "name", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="cell-input"
                                  value={titleValue}
                                  onChange={(e) =>
                                    handleCellChange(index, "title", e.target.value)
                                  }
                                  disabled={!titleColumn}
                                  placeholder={!titleColumn ? "-" : ""}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </article>
          </section>

          <aside className="preview-column">
            <section className="card preview-card">
              <div className="preview-topbar">
                <div>
                  <span className="section-kicker">Preview</span>
                  <h2 className="section-title">Organizational chart</h2>
                </div>
                <div className="field chart-theme-field">
                  <label className="label" htmlFor="chartTheme">
                    Style
                  </label>
                  <select
                    id="chartTheme"
                    className="select select-sm"
                    value={chartTheme}
                    onChange={(e) => setChartTheme(e.target.value)}
                  >
                    <option value="classic">Classic</option>
                    <option value="arrowed">Arrowed</option>
                    <option value="dashed">Dashed</option>
                  </select>
                </div>
              </div>

              <div className="action-bar">
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={!canExport}
                >
                  Export PDF
                </button>
              </div>

              {error && <p className="text-error">{error}</p>}

              <div className="preview-status">
                <div className="status-card">
                  <span className="status-card__label">Company</span>
                  <strong>{companyName || "Add company details"}</strong>
                </div>
                <div className="status-card">
                  <span className="status-card__label">Data</span>
                  <strong>{readyToBuild ? "Ready to build" : "Needs attention"}</strong>
                </div>
                <div className="status-card">
                  <span className="status-card__label">Export</span>
                  <strong>{canExport ? "PDF ready" : "Finish setup first"}</strong>
                </div>
              </div>

              {!rawRows.length && (
                <div className="empty-state">
                  <h3>Start by uploading your people file.</h3>
                  <p>
                    Once your data is mapped, the chart preview will appear here.
                  </p>
                </div>
              )}

              {rawRows.length > 0 && !rootNodes.length && hasMappings && (
                <div className="empty-state empty-state--warning">
                  <h3>We couldn't build the chart yet.</h3>
                  <p>
                    Check that each row includes a name and a unique ID, then review
                    manager relationships.
                  </p>
                </div>
              )}

              {rootNodes.length > 0 && hasMappings && (
                <>
                  <div className="chart-heading">
                    {logoDataUrl && (
                      <img
                        src={logoDataUrl}
                        alt="Company logo"
                        className="chart-logo"
                      />
                    )}
                    <div className="chart-heading__text">
                      <span className="section-kicker">Ready to share</span>
                      <h3 className="chart-title-text">
                        {companyName ? `${companyName} Organizational Chart` : "Organizational Chart"}
                      </h3>
                    </div>
                  </div>

                  <div className="chart-scroll">
                    <div className={`chart-wrapper theme-${chartTheme}`} ref={chartRef}>
                      <div className="chart-container">
                        {rootNodes.map((root) => (
                          <OrgNode key={root.id} node={root} />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function ColumnSelector({ label, required = false, value, onChange, columns }) {
  return (
    <div className="field">
      <label className="label">
        {label} {required && <span className="label-required">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select"
      >
        <option value="">Select a column</option>
        {columns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>
    </div>
  );
}

function OrgNode({ node }) {
  return (
    <div className="org-node">
      <div className="org-node-box">
        <div className="org-node-name">{node.name}</div>
        {node.title && <div className="org-node-title">{node.title}</div>}
      </div>
      {node.children && node.children.length > 0 && (
        <div className="org-children-wrapper">
          <div className="org-vertical-line" />
          <div className="org-children">
            {node.children.map((child) => (
              <OrgNode key={child.id} node={child} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

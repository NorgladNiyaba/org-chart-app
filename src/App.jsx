import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "./supabaseClient";

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

  const [savedCompanies, setSavedCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(null);

  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showSavedAccordion, setShowSavedAccordion] = useState(false);
  const [savedSearch, setSavedSearch] = useState("");

  const chartRef = useRef(null);

  // --- Load saved companies once from Supabase ---
  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoadingCompanies(true);
      setError("");
      try {
        const { data, error: dbError } = await supabase
          .from("org_companies")
          .select("*")
          .order("updated_at", { ascending: false });

        if (dbError) {
          console.error(dbError);
          setError("Could not load saved companies.");
          setSavedCompanies([]);
          return;
        }

        setSavedCompanies(data || []);
      } catch (e) {
        console.error(e);
        setError("Unexpected error loading companies.");
        setSavedCompanies([]);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  // --- CSV upload & parsing ---
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
          setError("The CSV appears to be empty.");
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

        // Handle the "everything ended up in one column" case
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

        setActiveCompanyId(null);
      },
      error: (err) => {
        console.error("PapaParse error:", err);
        setError("There was a problem parsing the CSV.");
      },
    });
  };

  // --- Logo upload ---
  const handleLogoChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, etc.).");
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
      setError("Failed to read logo file.");
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoDataUrl("");
  };

  // --- Build org tree structure ---
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
      setError("Error while building the org chart.");
      return [];
    }
  }, [rawRows, nameColumn, titleColumn, idColumn, managerIdColumn]);

  const hasMappings = useMemo(
    () => !!(nameColumn && idColumn),
    [nameColumn, idColumn]
  );

  // --- Inline table editing ---
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

  // --- Save / load / delete companies (Supabase) ---
  const handleSaveCompany = async () => {
    setError("");

    if (!companyName.trim()) {
      setError("Enter a company name before saving.");
      return;
    }
    if (!rawRows.length) {
      setError("Upload and map a CSV before saving.");
      return;
    }

    setIsSaving(true);
    const now = new Date().toISOString();

    const payload = {
      name: companyName.trim(),
      raw_rows: rawRows,
      columns,
      mappings: {
        nameColumn,
        titleColumn,
        idColumn,
        managerIdColumn,
        logoDataUrl,
      },
      updated_at: now,
    };

    try {
      let result;
      if (activeCompanyId) {
        const { data, error: dbError } = await supabase
          .from("org_companies")
          .update(payload)
          .eq("id", activeCompanyId)
          .select("*")
          .single();

        if (dbError) {
          console.error(dbError);
          setError("Could not update the company.");
          return;
        }
        result = data;
      } else {
        const { data, error: dbError } = await supabase
          .from("org_companies")
          .insert([{ ...payload }])
          .select("*")
          .single();

        if (dbError) {
          console.error(dbError);
          setError("Could not save the company.");
          return;
        }
        result = data;
      }

      const { data: all, error: listError } = await supabase
        .from("org_companies")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!listError) {
        setSavedCompanies(all || []);
      }

      setActiveCompanyId(result.id);
    } catch (e) {
      console.error(e);
      setError("Unexpected error while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadCompany = (companyId) => {
    setError("");
    const company = savedCompanies.find((c) => c.id === companyId);
    if (!company) {
      console.warn("Company not found for id", companyId);
      return;
    }

    const loadedRows =
      company.raw_rows ||
      company.rawRows ||
      company.rows ||
      [];

    const loadedColumns = company.columns || company.cols || [];
    const mappings = company.mappings || company.mapping || {};

    setActiveCompanyId(company.id);
    setCompanyName(company.name || "");
    setRawRows(Array.isArray(loadedRows) ? loadedRows : []);
    setColumns(Array.isArray(loadedColumns) ? loadedColumns : []);

    setNameColumn(mappings.nameColumn || "");
    setTitleColumn(mappings.titleColumn || "");
    setIdColumn(mappings.idColumn || "");
    setManagerIdColumn(mappings.managerIdColumn || "");
    setLogoDataUrl(mappings.logoDataUrl || "");

    // when loading a company, open the accordion if closed
    setShowSavedAccordion(true);
  };

  const handleDeleteCompany = async (companyId) => {
    setError("");
    setIsDeleting(true);
    try {
      const { error: dbError } = await supabase
        .from("org_companies")
        .delete()
        .eq("id", companyId);

      if (dbError) {
        console.error(dbError);
        setError("Could not delete the company.");
        return;
      }

      setSavedCompanies((prev) => prev.filter((c) => c.id !== companyId));
      if (activeCompanyId === companyId) {
        setActiveCompanyId(null);
      }
    } catch (e) {
      console.error(e);
      setError("Unexpected error while deleting.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Filtered saved companies for search ---
  const filteredSavedCompanies = useMemo(() => {
    if (!savedSearch.trim()) return savedCompanies;
    const q = savedSearch.toLowerCase();
    return savedCompanies.filter((c) =>
      (c.name || "").toLowerCase().includes(q)
    );
  }, [savedCompanies, savedSearch]);

  // --- PDF export with logo and footer ---
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

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(130, 130, 130);
      pdf.text(
        "Powered by Sparing Consulting Inc.",
        pageWidth / 2,
        pageHeight - 18,
        { align: "center" }
      );
      pdf.setTextColor(0, 0, 0);

      pdf.save("org-chart.pdf");
    } catch (e) {
      console.error(e);
      setError("Failed to generate PDF.");
    }
  };

  const savedCount = savedCompanies.length;

  return (
    <div className="shell">
      {/* Top bar */}
      <header className="shell-header">
        <div className="logo-block">
          <div className="logo-dot" />
          <span className="logo-text">Sparing Consulting</span>
          <span className="logo-separator">•</span>
          <span className="logo-app-name">Org Chart Studio</span>
        </div>
        <div className="header-right">
          <span className="header-badge">Internal tool</span>
        </div>
      </header>

      {/* Main content */}
      <main className="shell-main">
        {/* Saved companies accordion */}
        <section className="card">
          <div
            className="accordion-header"
            onClick={() => setShowSavedAccordion((prev) => !prev)}
          >
            <div className="accordion-title">
              <div className="card-title-row">
                <h2 className="card-title">Saved companies</h2>
                <span className="pill pill-muted">
                  {savedCount} {savedCount === 1 ? "company" : "companies"}
                </span>
              </div>
            </div>
            <span
              className={
                "accordion-chevron" +
                (showSavedAccordion ? " accordion-chevron--open" : "")
              }
            >
              ▾
            </span>
          </div>

          {showSavedAccordion && (
            <div className="accordion-body">
              {isLoadingCompanies ? (
                <p className="text-muted">Loading from Supabase…</p>
              ) : savedCompanies.length === 0 ? (
                <p className="text-muted">
                  Save a company after building a chart to access it here.
                </p>
              ) : (
                <>
                  <div className="saved-search-wrapper">
                    <input
                      type="text"
                      className="input"
                      placeholder="Search by name…"
                      value={savedSearch}
                      onChange={(e) => setSavedSearch(e.target.value)}
                    />
                  </div>
                  {filteredSavedCompanies.length === 0 ? (
                    <p className="text-muted text-small">
                      No companies match that search.
                    </p>
                  ) : (
                    <div className="saved-list">
                      {filteredSavedCompanies.map((c) => (
                        <div
                          key={c.id}
                          className={
                            "saved-item" +
                            (c.id === activeCompanyId ? " saved-item--active" : "")
                          }
                        >
                          <div className="saved-item-main">
                            <div className="saved-item-name">
                              {c.name || "Untitled company"}
                            </div>
                            {c.updated_at && (
                              <div className="saved-item-meta">
                                {new Date(c.updated_at).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </div>
                            )}
                          </div>
                          <div className="saved-item-actions">
                            <button
                              className="btn btn-outline"
                              type="button"
                              onClick={() => handleLoadCompany(c.id)}
                            >
                              Load
                            </button>
                            <button
                              className="btn btn-danger"
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteCompany(c.id)}
                            >
                              {isDeleting ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {/* Two-column layout for main workflow */}
        <div className="grid-main">
          {/* Left column: company + data config */}
          <div className="grid-col">
            {/* Company block */}
            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">Company</h2>
              </div>

              <div className="company-grid">
                <div className="field">
                  <label htmlFor="companyName" className="label">
                    Name
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
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Data import + mapping */}
            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">People data</h2>
                <span className="pill pill-soft">CSV</span>
              </div>

              <div className="field stack-sm">
                <label className="label">Upload CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="input-file"
                />
                <div className="text-muted text-small">
                  Expected columns: <span className="code">ID</span>,{" "}
                  <span className="code">ManagerID</span>,{" "}
                  <span className="code">Name</span>,{" "}
                  <span className="code">Title</span> (optional).
                </div>
                {rawRows.length > 0 && (
                  <div className="text-muted text-small">
                    Loaded <strong>{rawRows.length}</strong> rows.
                  </div>
                )}
              </div>

              <div className="divider" />

              <div className="mapping-grid">
                <ColumnSelector
                  label="Name column"
                  required
                  value={nameColumn}
                  onChange={setNameColumn}
                  columns={columns}
                />
                <ColumnSelector
                  label="Title column"
                  value={titleColumn}
                  onChange={setTitleColumn}
                  columns={columns}
                />
                <ColumnSelector
                  label="ID column"
                  required
                  value={idColumn}
                  onChange={setIdColumn}
                  columns={columns}
                />
                <ColumnSelector
                  label="Manager ID column"
                  value={managerIdColumn}
                  onChange={setManagerIdColumn}
                  columns={columns}
                />
              </div>
              {!hasMappings && rawRows.length > 0 && (
                <p className="text-error">
                  Map at least a Name and ID column to build the chart.
                </p>
              )}
            </section>

            {/* Table editing */}
            <section className="card">
              <div className="card-title-row">
                <h2 className="card-title">Table view</h2>
              </div>

              {rawRows.length === 0 ? (
                <p className="text-muted">
                  Upload a CSV to review and edit rows.
                </p>
              ) : !hasMappings ? (
                <p className="text-muted">
                  Map Name and ID to edit in a structured table.
                </p>
              ) : (
                <>
                  <div className="text-muted text-small mb-2">
                    Edit cells inline. Changes apply immediately.
                  </div>
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
                                    handleCellChange(
                                      index,
                                      "manager",
                                      e.target.value
                                    )
                                  }
                                  disabled={!managerIdColumn}
                                  placeholder={
                                    !managerIdColumn ? "—" : ""
                                  }
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
                                  placeholder={!titleColumn ? "—" : ""}
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
            </section>
          </div>

          {/* Right column: chart + actions */}
          <div className="grid-col">
            <section className="card card-chart">
              <div className="card-title-row">
                <h2 className="card-title">Org chart</h2>
                <div className="card-title-actions">
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={handleSaveCompany}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? "Saving…"
                      : activeCompanyId
                      ? "Update company"
                      : "Save company"}
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={!rootNodes.length || !hasMappings}
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              {error && <p className="text-error mb-2">{error}</p>}

              {!rawRows.length && (
                <p className="text-muted">
                  Upload data and map columns to render a chart.
                </p>
              )}

              {rawRows.length > 0 && !rootNodes.length && hasMappings && (
                <p className="text-error">
                  No valid nodes could be built. Check for missing IDs or Names.
                </p>
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
                    {companyName ? (
                      <h3 className="chart-title-text">
                        {companyName} Organizational Chart
                      </h3>
                    ) : (
                      <h3 className="chart-title-text">Organizational Chart</h3>
                    )}
                  </div>

                  <div className="chart-wrapper" ref={chartRef}>
                    <div className="chart-container">
                      {rootNodes.map((root) => (
                        <OrgNode key={root.id} node={root} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
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
        <option value="">Not mapped</option>
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

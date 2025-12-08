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

/**
 * RawRow: object where keys are column names from CSV and values are strings
 * PersonNode: {
 *   id: string;
 *   name: string;
 *   title: string;
 *   managerId: string | null;
 *   children: PersonNode[];
 * }
 */

function App() {
  const [rawRows, setRawRows] = useState([]); // parsed CSV rows
  const [columns, setColumns] = useState([]); // column names from CSV header

  // Mapped columns
  const [nameColumn, setNameColumn] = useState("");
  const [titleColumn, setTitleColumn] = useState("");
  const [idColumn, setIdColumn] = useState("");
  const [managerIdColumn, setManagerIdColumn] = useState("");

  const [companyName, setCompanyName] = useState(""); // company name input
  const [logoDataUrl, setLogoDataUrl] = useState(""); // company logo (base64)
  const [error, setError] = useState("");

  // Saved companies & active one
  const [savedCompanies, setSavedCompanies] = useState([]); // rows from org_companies
  const [activeCompanyId, setActiveCompanyId] = useState(null);

  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const chartRef = useRef(null);

  // ---------- LOAD COMPANIES FROM SUPABASE ONCE ----------

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
          setError("Failed to load saved companies from the server.");
          setSavedCompanies([]);
          return;
        }

        setSavedCompanies(data || []);
      } catch (e) {
        console.error(e);
        setError("Unexpected error while loading companies.");
        setSavedCompanies([]);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  // ---------- FILE UPLOAD & PARSING ----------

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { data, errors, meta } = results;

        console.log("Papa parse results:", results); // helpful for debugging

        if (!data || data.length === 0) {
          setError("The CSV seems to be empty.");
          return;
        }

        // Non-fatal issues (e.g. FieldMismatch) – log but don't block
        if (errors && errors.length > 0) {
          console.warn("PapaParse warnings:", errors);
        }

        let finalData = data;
        let finalColumns =
          meta && Array.isArray(meta.fields) && meta.fields.length
            ? meta.fields
            : Object.keys(data[0]);

        // SPECIAL FIX:
        // If Papa thinks there's only one column and that column name contains commas
        // (e.g. "ID,ManagerID,Name,Title"), then our file is actually "one big field per row"
        // and we need to manually split it into real columns.
        if (
          finalColumns.length === 1 &&
          typeof finalColumns[0] === "string" &&
          finalColumns[0].includes(",")
        ) {
          const combinedHeader = finalColumns[0];
          const headerParts = combinedHeader.split(",").map((h) => h.trim());

          console.log("Detected combined header, splitting into:", headerParts);

          finalColumns = headerParts;

          // Rebuild data rows: each row currently has a single key (combinedHeader)
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

        // Reset mappings (we let the user re-map for this dataset)
        setNameColumn("");
        setTitleColumn("");
        setIdColumn("");
        setManagerIdColumn("");

        // Reset active company (this is now a draft until saved)
        setActiveCompanyId(null);
      },
      error: (err) => {
        console.error("PapaParse fatal error:", err);
        setError("There was a problem parsing the CSV file.");
      },
    });
  };

  // ---------- LOGO UPLOAD ----------

  const handleLogoChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file for the logo (PNG, JPG, etc.).");
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

  // ---------- ORG TREE BUILDING ----------

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
          console.warn(`Row ${index + 1} is missing an ID. It will be ignored.`);
          return;
        }
        if (!name) {
          console.warn(`Row ${index + 1} is missing a Name. It will be ignored.`);
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
      setError("Error while building the org chart tree. Check console for details.");
      return [];
    }
  }, [rawRows, nameColumn, titleColumn, idColumn, managerIdColumn]);

  const hasMappings = useMemo(() => {
    return !!(nameColumn && idColumn);
  }, [nameColumn, idColumn]);

  // ---------- INLINE DATA EDITING ----------

  const handleCellChange = (rowIndex, fieldType, value) => {
    // fieldType: 'id' | 'name' | 'title' | 'manager'
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

  // ---------- SAVE / LOAD / DELETE COMPANIES (SUPABASE) ----------

  const handleSaveCompany = async () => {
    setError("");

    if (!companyName.trim()) {
      setError("Please enter a company name before saving.");
      return;
    }
    if (!rawRows.length) {
      setError("Please upload a CSV and map its columns before saving.");
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
        // Update existing row
        const { data, error: dbError } = await supabase
          .from("org_companies")
          .update(payload)
          .eq("id", activeCompanyId)
          .select("*")
          .single();

        if (dbError) {
          console.error(dbError);
          setError("Failed to update company in the database.");
          return;
        }
        result = data;
      } else {
        // Insert new row
        const { data, error: dbError } = await supabase
          .from("org_companies")
          .insert([{ ...payload }])
          .select("*")
          .single();

        if (dbError) {
          console.error(dbError);
          setError("Failed to save company in the database.");
          return;
        }
        result = data;
      }

      // Refresh list from Supabase (so savedCompanies is in sync)
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
      setError("Unexpected error while saving company.");
    } finally {
      setIsSaving(false);
    }
  };

  // 🔧 FIXED: Load from savedCompanies in memory instead of calling Supabase again
  const handleLoadCompany = (companyId) => {
    setError("");
    const company = savedCompanies.find((c) => c.id === companyId);
    if (!company) {
      console.warn("Company not found for id", companyId);
      return;
    }

    setActiveCompanyId(company.id);
    setCompanyName(company.name || "");
    setRawRows(company.raw_rows || []);
    setColumns(company.columns || []);

    const m = company.mappings || {};
    setNameColumn(m.nameColumn || "");
    setTitleColumn(m.titleColumn || "");
    setIdColumn(m.idColumn || "");
    setManagerIdColumn(m.managerIdColumn || "");
    setLogoDataUrl(m.logoDataUrl || "");
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
        setError("Failed to delete company from the database.");
        return;
      }

      setSavedCompanies((prev) => prev.filter((c) => c.id !== companyId));
      if (activeCompanyId === companyId) {
        setActiveCompanyId(null);
      }
    } catch (e) {
      console.error(e);
      setError("Unexpected error while deleting company.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------- PDF EXPORT (WITH LOGO) ----------

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;
    try {
      // Prepare logo (if any)
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
        scale: 2, // better resolution
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

      // --- HEADER (logo + title) ---
      let headerTop = 20;
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

      const topMargin = titleY + 20;

      // --- CHART IMAGE ---
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

      // FOOTER TEXT (fine print)
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
      setError("Failed to generate PDF. Check console for details.");
    }
  };

  // ---------- RENDER ----------

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Organizational Chart Generator</h1>
        <p>
          Upload and edit people data, map columns, generate an organizational chart, and save
          companies centrally using Supabase. Then export charts as branded PDFs.
        </p>
      </header>

      {/* SAVED COMPANIES BAR */}
      <section className="app-section">
        <h2>Saved companies</h2>
        {isLoadingCompanies ? (
          <p className="hint">Loading companies from server…</p>
        ) : savedCompanies.length === 0 ? (
          <p className="hint">
            No companies saved yet. Once you upload data and set up the chart, click{" "}
            <strong>Save company</strong> in Step 4.
          </p>
        ) : (
          <div className="saved-list">
            {savedCompanies.map((c) => (
              <div
                key={c.id}
                className={
                  "saved-item" + (c.id === activeCompanyId ? " saved-item--active" : "")
                }
              >
                <div className="saved-item-main">
                  <div className="saved-item-name">{c.name || "Untitled company"}</div>
                  {c.updated_at && (
                    <div className="saved-item-meta">
                      Last updated:{" "}
                      {new Date(c.updated_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  )}
                </div>
                <div className="saved-item-actions">
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => handleLoadCompany(c.id)}
                  >
                    Load
                  </button>
                  <button
                    className="danger-btn"
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
      </section>

      {/* STEP 1 */}
      <section className="app-section">
        <h2>1. Company info, logo & CSV upload</h2>

        <div className="company-grid">
          <div className="company-name-row">
            <label htmlFor="companyName">Company name</label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
            />
            <p className="hint small">
              This will appear as the title on the exported PDF (e.g. “Acme Corp Organizational
              Chart”).
            </p>
          </div>

          <div className="logo-row">
            <label htmlFor="companyLogo">Company logo (optional)</label>
            <input
              id="companyLogo"
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
            />
            {logoDataUrl ? (
              <div className="logo-preview-wrapper">
                <img
                  src={logoDataUrl}
                  alt="Company logo preview"
                  className="logo-preview"
                />
                <button
                  type="button"
                  className="text-btn"
                  onClick={clearLogo}
                >
                  Remove logo
                </button>
              </div>
            ) : (
              <p className="hint small">
                If provided, the logo will appear above the company name in the chart preview and
                the exported PDF.
              </p>
            )}
          </div>
        </div>

        <p className="hint">
          Expected CSV columns: <strong>ID</strong>, <strong>ManagerID</strong> (optional),{" "}
          <strong>Name</strong>, <strong>Title</strong> (optional).
        </p>

        <input type="file" accept=".csv" onChange={handleFileUpload} />
        {rawRows.length > 0 && (
          <p className="hint small">
            Loaded <strong>{rawRows.length}</strong> rows. Next, map the columns below.
          </p>
        )}
      </section>

      {/* STEP 2 – mapping */}
      <section className="app-section">
        <h2>2. Map columns</h2>

        {columns.length === 0 ? (
          <p className="hint">
            Upload a CSV in Step 1 to choose which columns correspond to Name, Title, ID, and
            Manager.
          </p>
        ) : (
          <>
            <div className="mapping-grid">
              <ColumnSelector
                label="Name column (required)"
                value={nameColumn}
                onChange={setNameColumn}
                columns={columns}
              />
              <ColumnSelector
                label="Title column (optional)"
                value={titleColumn}
                onChange={setTitleColumn}
                columns={columns}
              />
              <ColumnSelector
                label="ID column (required)"
                value={idColumn}
                onChange={setIdColumn}
                columns={columns}
              />
              <ColumnSelector
                label="Manager ID column (optional)"
                value={managerIdColumn}
                onChange={setManagerIdColumn}
                columns={columns}
              />
            </div>
            {!hasMappings && (
              <p className="hint error">
                Please select at least a Name and an ID column to build the chart.
              </p>
            )}
          </>
        )}
      </section>

      {/* STEP 3 – inline data editing */}
      <section className="app-section">
        <h2>3. Review & edit people data</h2>

        {rawRows.length === 0 ? (
          <p className="hint">
            Upload a CSV in Step 1 to see and edit the people data here.
          </p>
        ) : !hasMappings ? (
          <p className="hint">
            Map at least the <strong>Name</strong> and <strong>ID</strong> columns in Step 2 to
            edit the data in a structured table.
          </p>
        ) : (
          <>
            <p className="hint small">
              Edit values directly in the table below. Changes will immediately update the org
              chart in Step 4.
            </p>
            <div className="data-table-wrapper">
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
                    const nameValue = nameColumn ? String(row[nameColumn] ?? "") : "";
                    const titleValue = titleColumn ? String(row[titleColumn] ?? "") : "";

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
                            placeholder={!managerIdColumn ? "No column mapped" : ""}
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
                            placeholder={!titleColumn ? "No column mapped" : ""}
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

      {/* STEP 4 – chart + save + export */}
      <section className="app-section">
        <h2>4. Org chart preview, save & export</h2>
        {error && <p className="hint error">{error}</p>}
        {!rawRows.length && <p className="hint">Upload a CSV to see the chart here.</p>}
        {rawRows.length > 0 && !rootNodes.length && hasMappings && (
          <p className="hint error">
            No valid nodes could be built. Check the console for warnings (missing ID / Name, etc.).
          </p>
        )}

        {rootNodes.length > 0 && hasMappings && (
          <>
            <div className="chart-heading">
              {logoDataUrl && (
                <img
                  src={logoDataUrl}
                  alt="Company logo"
                  className="chart-company-logo"
                />
              )}
              {companyName ? (
                <h3 className="chart-title">{companyName} Organizational Chart</h3>
              ) : (
                <h3 className="chart-title">Organizational Chart</h3>
              )}
            </div>

            <div className="chart-wrapper" ref={chartRef}>
              <div className="chart-container">
                {rootNodes.map((root) => (
                  <OrgNode key={root.id} node={root} />
                ))}
              </div>
            </div>

            <div className="actions-row">
              <button
                className="secondary-btn"
                type="button"
                onClick={handleSaveCompany}
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving…"
                  : activeCompanyId
                  ? "Update saved company"
                  : "Save company"}
              </button>
              <button className="primary-btn" type="button" onClick={handleDownloadPDF}>
                Download as PDF
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ColumnSelector({ label, value, onChange, columns }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- Not selected --</option>
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

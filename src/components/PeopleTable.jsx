import Icon from "./Icon.jsx";

function PeopleTable({ rows, mapping, onCellChange, onAddRow, onDeleteRow }) {
  const {
    id: idColumn,
    name: nameColumn,
    title: titleColumn,
    managerId: managerColumn,
  } = mapping;

  const fields = [
    { key: "id", column: idColumn, header: "ID" },
    { key: "managerId", column: managerColumn, header: "Manager ID" },
    { key: "name", column: nameColumn, header: "Name" },
    { key: "title", column: titleColumn, header: "Title" },
  ];

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <span className="table-title">People</span>
        <div className="row" style={{ gap: "var(--s2)" }}>
          <span className="badge badge-neutral badge-pill">{rows.length} rows</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddRow}>
            <Icon name="plus" />
            Add person
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.key}>{field.header}</th>
              ))}
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {fields.map((field) => (
                  <td key={field.key}>
                    <input
                      className="cell-input"
                      value={field.column ? String(row[field.column] ?? "") : ""}
                      onChange={(e) => onCellChange(index, field.key, e.target.value)}
                      disabled={!field.column}
                      placeholder={field.column ? "" : "—"}
                      aria-label={`${field.header}, row ${index + 1}`}
                    />
                  </td>
                ))}
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn btn-icon btn-sm"
                    onClick={() => onDeleteRow(index)}
                    title="Remove this person — their reports move up to their manager"
                    aria-label={`Remove row ${index + 1}`}
                  >
                    <Icon name="trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PeopleTable;

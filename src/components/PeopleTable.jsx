function PeopleTable({ rows, mapping, onCellChange }) {
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
        <span className="badge badge-neutral badge-pill">{rows.length} rows</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.key}>{field.header}</th>
              ))}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PeopleTable;

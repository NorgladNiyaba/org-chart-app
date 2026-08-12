import { useId, useState } from "react";
import Icon from "./Icon.jsx";

function FileDrop({ accept, icon = "upload", title, hint, fileName, onFile }) {
  const id = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`upload${isDragging ? " is-dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <span className={`ic-wrap ic-lg${fileName ? " ic-active" : ""}`}>
        <Icon name={fileName ? "check" : icon} />
      </span>
      <div className="upload__text">
        <div className="upload__title">{fileName || title}</div>
        <div className="upload__hint">{fileName ? "Drop another file to replace it" : hint}</div>
      </div>
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
        aria-label={title}
      />
    </div>
  );
}

export default FileDrop;

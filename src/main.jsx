import React from "react";
import ReactDOM from "react-dom/client";

// Self-hosted so the app renders identically offline and the PDF pipeline can
// embed the same faces. Weights follow the Plexa One v5 type scale.
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";

import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

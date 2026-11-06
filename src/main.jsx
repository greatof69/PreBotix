import "./pbScrollVisibility.js";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./imageProtection.js";
import "./price-tooltip.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter basename="/PreBotix">
    <App />
  </BrowserRouter>
);


// Bridges modern Vite/ESM to the legacy CDN-style codebase.
// The original project shipped React via <script> tags so every module could
// reference the bare `React` and `ReactDOM` globals. By importing the package
// here and exposing it on `globalThis` before any other module evaluates, we
// preserve that contract without touching the legacy files.
import React from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";

window.React = React;
window.ReactDOM = ReactDOM;
window.createPortal = createPortal;

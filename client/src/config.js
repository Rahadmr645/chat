const stripTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const runtimeOrigin =
  typeof window !== "undefined"
    ? stripTrailingSlash(window.location.origin)
    : "http://localhost:5173";

const envApiBase = stripTrailingSlash(import.meta.env.VITE_API_URL || "");
const envSocketBase = stripTrailingSlash(import.meta.env.VITE_SOCKET_URL || "");

const defaultBase = envApiBase || runtimeOrigin;

export const API_URL = defaultBase;
export const SOCKET_URL = envSocketBase || defaultBase;

export const TURN_URL = import.meta.env.VITE_TURN_URL ?? "";
export const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME ?? "";
export const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL ?? "";

const runtimeOrigin =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

export const API_URL = import.meta.env.VITE_API_URL ?? runtimeOrigin;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? runtimeOrigin;

export const TURN_URL = import.meta.env.VITE_TURN_URL ?? "";
export const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME ?? "";
export const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL ?? "";
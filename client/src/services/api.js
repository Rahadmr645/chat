import { API_URL } from "../config.js";

export const joinApiUrl = (path) => {
  const base = String(API_URL || "").replace(/\/+$/, "");
  const p = String(path || "").startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api") && p.startsWith("/api/")) {
    return `${base}${p.slice(4)}`;
  }
  return `${base}${p}`;
};

const buildHeaders = (token, extraHeaders = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const apiRequest = async ({ method = "GET", path, token, body }) => {
  const url = joinApiUrl(path);
  const response = await fetch(url, {
    method,
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const fromBody =
      data && typeof data === "object"
        ? [data.error, data.message].find((x) => typeof x === "string" && x.trim())
        : null;
    const hint404 =
      response.status === 404
        ? `Not found (${path}). If you just updated the app, restart the API server so new routes (e.g. /api/calls) are loaded.`
        : null;
    const msg =
      fromBody ||
      hint404 ||
      (raw && raw.length < 240 && !raw.trim().startsWith("<") ? raw.trim() : null) ||
      `Request failed (${response.status})`;
    throw new Error(msg);
  }

  if (data == null || typeof data !== "object") {
    throw new Error(
      "Server response is invalid. Restart client dev server and open the latest HTTPS URL."
    );
  }

  return data;
};

export const apiUploadVoice = async ({ token, receiverId, durationSec, blob, filename = "voice.webm" }) => {
  const formData = new FormData();
  formData.append("receiverId", String(receiverId));
  formData.append("durationSec", String(durationSec));
  formData.append("audio", blob, filename);

  const response = await fetch(joinApiUrl("/api/messages/voice"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Voice upload failed");
  }

  return data;
};

export const apiUploadProfilePhoto = async ({ token, file }) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(joinApiUrl("/api/auth/profile/photo"), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Profile photo upload failed");
  }
  return data;
};

export const apiUploadMediaMessage = async ({
  token,
  receiverId,
  file,
  text = "",
}) => {
  const formData = new FormData();
  formData.append("receiverId", String(receiverId));
  formData.append("text", String(text || ""));
  formData.append("media", file, file.name || "media");

  const response = await fetch(joinApiUrl("/api/messages/media"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Media upload failed");
  }
  return data;
};
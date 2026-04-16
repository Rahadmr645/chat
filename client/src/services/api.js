import { API_URL } from "../config.js";

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
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const data = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  if (!isJson) {
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

  const response = await fetch(`${API_URL}/api/messages/voice`, {
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

  const response = await fetch(`${API_URL}/api/auth/profile/photo`, {
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

  const response = await fetch(`${API_URL}/api/messages/media`, {
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
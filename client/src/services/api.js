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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
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
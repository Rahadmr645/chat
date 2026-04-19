/**
 * Browser-only E2EE for 1:1 text (and media captions): ECDH P-256 + HKDF + AES-GCM.
 * Private keys live in localStorage; the server only stores ciphertext and public keys.
 */

const pkcs8StorageKey = (userId) => `rchat_e2ee_ecdh_pkcs8_${String(userId)}`;
const HKDF_INFO = new TextEncoder().encode("rchat-e2ee-text-v1");

const b64Encode = (bytes) => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i += 1) s += String.fromCharCode(u[i]);
  return btoa(s);
};

const b64Decode = (b64) => {
  const bin = atob(String(b64).trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};

const publicJwkFromPair = async (keyPair) => {
  const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return JSON.stringify({
    kty: pubJwk.kty,
    crv: pubJwk.crv,
    x: pubJwk.x,
    y: pubJwk.y,
    ext: true,
  });
};

const publicJwkFromPrivate = async (privateKey) => {
  const jwkFull = await crypto.subtle.exportKey("jwk", privateKey);
  return JSON.stringify({
    kty: jwkFull.kty,
    crv: jwkFull.crv,
    x: jwkFull.x,
    y: jwkFull.y,
    ext: true,
  });
};

export async function ensureDeviceKeys(userId) {
  const id = String(userId);
  const stored = localStorage.getItem(pkcs8StorageKey(id));
  if (!stored) {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    localStorage.setItem(pkcs8StorageKey(id), b64Encode(new Uint8Array(pkcs8)));
    const publicJwkString = await publicJwkFromPair(pair);
    return { publicJwkString };
  }
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    b64Decode(stored),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const publicJwkString = await publicJwkFromPrivate(privateKey);
  return { publicJwkString };
}

async function loadPrivateKey(userId) {
  const stored = localStorage.getItem(pkcs8StorageKey(String(userId)));
  if (!stored) {
    throw new Error("Missing encryption keys on this device");
  }
  return crypto.subtle.importKey(
    "pkcs8",
    b64Decode(stored),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
}

async function importPeerPublic(jwkString) {
  const j = JSON.parse(String(jwkString));
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: j.x,
      y: j.y,
      ext: true,
    },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

async function deriveAesGcmKey(privateKey, peerPublicKey) {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    256
  );
  const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: HKDF_INFO,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptTextForPeer({ userId, peerPublicJwk, plaintext }) {
  const myPrivate = await loadPrivateKey(userId);
  const peerPub = await importPeerPublic(peerPublicJwk);
  const aesKey = await deriveAesGcmKey(myPrivate, peerPub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      new TextEncoder().encode(plaintext)
    )
  );
  return {
    ciphertextB64: b64Encode(ct),
    ivB64: b64Encode(iv),
  };
}

export async function decryptConversationText({ userId, peerPublicJwk, ciphertextB64, ivB64 }) {
  const myPrivate = await loadPrivateKey(userId);
  const peerPub = await importPeerPublic(peerPublicJwk);
  const aesKey = await deriveAesGcmKey(myPrivate, peerPub);
  const iv = b64Decode(ivB64);
  const ct = b64Decode(ciphertextB64);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
  return new TextDecoder().decode(buf);
}

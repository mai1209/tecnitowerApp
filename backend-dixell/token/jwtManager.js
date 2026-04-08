import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_EXP_SECONDS = 60 * 60; // 1 hora
const ALGORITHM = "HS256";

function makeBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodeSegment(obj) {
  const json = typeof obj === "string" ? obj : JSON.stringify(obj);
  return makeBase64Url(json);
}

function decodeSegment(segment) {
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Falta JWT_SECRET en variables de entorno");
  }
  return secret;
}

function createSignature(input, secret) {
  return createHmac("sha256", secret).update(input).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signAccessToken(payload, options = {}) {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const expSeconds =
    Number(options.expiresInSeconds ?? process.env.JWT_EXPIRES_IN_SECONDS ?? DEFAULT_EXP_SECONDS) || DEFAULT_EXP_SECONDS;

  const header = {
    alg: ALGORITHM,
    typ: "JWT",
  };

  const body = {
    ...payload,
    iat: now,
    exp: now + expSeconds,
  };

  const encodedHeader = encodeSegment(header);
  const encodedPayload = encodeSegment(body);
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createSignature(data, secret);

  return `${data}.${signature}`;
}

export function verifyAccessToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");
  if (!headerSegment || !payloadSegment || !signatureSegment) {
    return null;
  }

  const secret = getSecret();
  const data = `${headerSegment}.${payloadSegment}`;
  const expectedSignature = createSignature(data, secret);
  const providedBuffer = Buffer.from(signatureSegment);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  const isValidSignature = timingSafeEqual(providedBuffer, expectedBuffer);
  if (!isValidSignature) {
    return null;
  }

  const payload = decodeSegment(payloadSegment);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    return null;
  }

  return payload;
}

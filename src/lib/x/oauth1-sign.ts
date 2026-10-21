import { createHmac, randomBytes } from "node:crypto";

/** RFC 3986 percent-encoding as required by OAuth 1.0a. */
export function oauthPercentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export type OAuth1SignInput = {
  method: string;
  baseUrl: string;
  queryParams?: Record<string, string>;
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  nonce: string;
  timestamp: string;
};

export type OAuth1SignedRequest = {
  authorizationHeader: string;
  signature: string;
};

function buildParameterString(
  oauthParams: Record<string, string>,
  extraParams: Record<string, string> = {},
): string {
  const pairs = { ...extraParams, ...oauthParams };
  return Object.keys(pairs)
    .sort()
    .map(
      (key) =>
        `${oauthPercentEncode(key)}=${oauthPercentEncode(pairs[key] ?? "")}`,
    )
    .join("&");
}

function buildSignatureBaseString(
  method: string,
  baseUrl: string,
  parameterString: string,
): string {
  return [
    method.toUpperCase(),
    oauthPercentEncode(baseUrl),
    oauthPercentEncode(parameterString),
  ].join("&");
}

function signingKey(consumerSecret: string, tokenSecret: string): string {
  return `${oauthPercentEncode(consumerSecret)}&${oauthPercentEncode(tokenSecret)}`;
}

export function signOAuth1Request(input: OAuth1SignInput): OAuth1SignedRequest {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: input.consumerKey,
    oauth_nonce: input.nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: input.timestamp,
    oauth_token: input.accessToken,
    oauth_version: "1.0",
  };

  const parameterString = buildParameterString(
    oauthParams,
    input.queryParams ?? {},
  );
  const baseString = buildSignatureBaseString(
    input.method,
    input.baseUrl,
    parameterString,
  );
  const signature = createHmac(
    "sha1",
    signingKey(input.consumerSecret, input.accessTokenSecret),
  )
    .update(baseString)
    .digest("base64");

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const authorizationHeader = `OAuth ${Object.keys(headerParams)
    .sort()
    .map(
      (key) =>
        `${oauthPercentEncode(key)}="${oauthPercentEncode(headerParams[key] ?? "")}"`,
    )
    .join(", ")}`;

  return { authorizationHeader, signature };
}

export function generateOAuthNonce(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\W/g, "");
}

export function oauthTimestampSeconds(nowMs = Date.now()): string {
  return Math.floor(nowMs / 1000).toString();
}

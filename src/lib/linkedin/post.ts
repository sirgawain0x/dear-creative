import {
  getLinkedInApiVersion,
  LINKEDIN_POSTS_URL,
} from "./config";
import { isLinkedInPostingEnabled } from "./feature-flag";
import {
  LinkedInPostingDisabledError,
  LinkedInReauthRequiredError,
} from "./errors";
import { linkedInFetch } from "./http";
import {
  assertLinkedInAccessTokenValid,
  loadLinkedInPersonalCredentials,
} from "./token-store";

export type LinkedInTextPostInput = {
  commentary: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
};

export type LinkedInPostResult = {
  postId: string;
};

export function buildLinkedInTextPostBody(
  authorUrn: string,
  input: LinkedInTextPostInput,
): Record<string, unknown> {
  return {
    author: authorUrn,
    commentary: input.commentary,
    visibility: input.visibility ?? "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

export async function postToLinkedInPersonalProfile(
  input: LinkedInTextPostInput,
  nowMs = Date.now(),
): Promise<LinkedInPostResult> {
  if (!isLinkedInPostingEnabled()) {
    throw new LinkedInPostingDisabledError();
  }
  const creds = await loadLinkedInPersonalCredentials();
  if (!creds) {
    throw new LinkedInReauthRequiredError(
      "LinkedIn is not connected; complete OAuth first.",
    );
  }
  assertLinkedInAccessTokenValid(creds, nowMs);

  const body = buildLinkedInTextPostBody(creds.authorUrn, input);
  const apiVersion = getLinkedInApiVersion();
  const res = await linkedInFetch(LINKEDIN_POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": apiVersion,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new LinkedInReauthRequiredError();
    }
    throw new Error("linkedin_post_failed");
  }

  const postId = res.headers.get("x-restli-id")?.trim();
  if (!postId) {
    throw new Error("linkedin_post_missing_id");
  }
  return { postId };
}

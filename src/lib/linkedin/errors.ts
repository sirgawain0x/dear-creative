export class LinkedInReauthRequiredError extends Error {
  readonly code = "linkedin_reauth_required" as const;

  constructor(message = "LinkedIn access token expired; re-authenticate.") {
    super(message);
    this.name = "LinkedInReauthRequiredError";
  }
}

export class LinkedInPostingDisabledError extends Error {
  readonly code = "linkedin_posting_disabled" as const;

  constructor(message = "LinkedIn posting is disabled.") {
    super(message);
    this.name = "LinkedInPostingDisabledError";
  }
}

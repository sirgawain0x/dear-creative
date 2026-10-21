import { describe, expect, it } from "vitest";
import { oauthPercentEncode, signOAuth1Request } from "./oauth1-sign";

describe("signOAuth1Request", () => {
  it("matches the X docs HMAC-SHA1 vector for statuses/update (form body in params)", () => {
    const { signature } = signOAuth1Request({
      method: "POST",
      baseUrl: "https://api.x.com/1.1/statuses/update.json",
      queryParams: {
        include_entities: "true",
        status: "Hello Ladies + Gentlemen, a signed OAuth request!",
      },
      consumerKey: "xvz1evFS4wEEPTGEFPHBog",
      consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
      accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
      accessTokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      timestamp: "1318622958",
    });

    expect(signature).toBe("Ls93hJiZbQ3akF3HF3x1Bz8/zU4=");
  });

  it("signs POST /2/tweets with oauth params only (JSON body excluded)", () => {
    const { signature, authorizationHeader } = signOAuth1Request({
      method: "POST",
      baseUrl: "https://api.x.com/2/tweets",
      consumerKey: "xvz1evFS4wEEPTGEFPHBog",
      consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
      accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
      accessTokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      timestamp: "1318622958",
    });

    expect(signature).toBe("lr+tV/DKclEvXKVjG6tgaSSLV0k=");
    expect(authorizationHeader).toContain("oauth_signature=");
    expect(authorizationHeader).toContain(
      `${oauthPercentEncode("oauth_signature")}="${oauthPercentEncode(signature)}"`,
    );
    expect(authorizationHeader).not.toContain("text=");
  });
});

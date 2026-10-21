import { describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { createAdminWalletSendPort } from "./admin-wallet-send-port";

describe("createAdminWalletSendPort", () => {
  it("uses preview mode without calling fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const port = createAdminWalletSendPort({
      previewMode: true,
      getRequestHeaders: async () => ({ Authorization: "Bearer x" }),
    });

    const estimate = await port.estimateSend({
      recipient: getAddress("0x2222222222222222222222222222222222222222"),
      amount: "1",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(estimate).toMatchObject({ amount: "1" });

    const sent = await port.executeSend({
      recipient: getAddress("0x2222222222222222222222222222222222222222"),
      amount: "1",
    });
    expect(sent.ok).toBe(true);
    fetchMock.mockRestore();
  });
});

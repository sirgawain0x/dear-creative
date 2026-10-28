import { test, expect } from "@playwright/test";

const widths = [390, 600, 840] as const;

function walletOverlayHtml(portalToBody: boolean) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  body { margin: 0; font-family: system-ui, sans-serif; min-height: 120vh; background: #fafafa; }
  header {
    position: sticky; top: 0; z-index: 40;
    border-bottom: 1px solid #e4e4e7;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .bar { display: flex; justify-content: space-between; padding: 14px 16px; }
  .overlay {
    position: fixed; inset: 0; z-index: 50;
    display: flex; justify-content: flex-end;
    background: rgba(24,24,27,0.4);
  }
  aside {
    width: min(100%, 28rem); height: 100%; background: #fff;
    border-left: 1px solid #e4e4e7; padding: 16px;
  }
</style></head><body>
  <header id="hdr">
    <div class="bar"><strong>Dear Creative</strong><span>Menu → Wallet</span></div>
    <div id="overlay-host"></div>
  </header>
  <script>
    const portal = ${portalToBody ? "true" : "false"};
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('data-testid', 'reader-wallet-sheet-overlay');
    overlay.innerHTML = '<aside data-testid="reader-wallet-sheet" role="dialog"><h2>Wallet</h2><button type="button">Close</button></aside>';
    const host = document.getElementById('overlay-host');
    if (portal) document.body.appendChild(overlay);
    else host.appendChild(overlay);
  </script>
</body></html>`;
}

test.describe("Reader wallet overlay (backdrop-blur containing block)", () => {
  test("legacy in-header fixed overlay is clipped to the header strip", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.setContent(walletOverlayHtml(false));
    const metrics = await page.evaluate(() => {
      const overlay = document.querySelector(
        '[data-testid="reader-wallet-sheet-overlay"]',
      );
      if (!overlay) return null;
      const rect = overlay.getBoundingClientRect();
      return {
        height: rect.height,
        innerHeight: window.innerHeight,
        parentTag: overlay.parentElement?.tagName ?? null,
      };
    });
    expect(metrics?.parentTag).toBe("DIV");
    expect(metrics!.height).toBeLessThan(100);
    expect(metrics!.height).toBeLessThan(metrics!.innerHeight * 0.2);
  });

  for (const width of widths) {
    test(`portaled overlay fills viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(walletOverlayHtml(true));
      const metrics = await page.evaluate(() => {
        const overlay = document.querySelector(
          '[data-testid="reader-wallet-sheet-overlay"]',
        );
        const sheet = document.querySelector('[data-testid="reader-wallet-sheet"]');
        if (!overlay || !sheet) return null;
        return {
          overlayHeight: overlay.getBoundingClientRect().height,
          sheetHeight: sheet.getBoundingClientRect().height,
          innerHeight: window.innerHeight,
          parentTag: overlay.parentElement?.tagName ?? null,
        };
      });
      expect(metrics?.parentTag).toBe("BODY");
      expect(metrics!.overlayHeight).toBeGreaterThanOrEqual(
        metrics!.innerHeight * 0.95,
      );
      expect(metrics!.sheetHeight).toBeGreaterThan(400);
    });
  }
});

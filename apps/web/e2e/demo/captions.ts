/**
 * The caption overlay: a fixed bar at the bottom of the viewport, injected by the harness at run
 * time. No app source file knows about it. The current text lives in the test process; an init
 * script asks for it on every document load, so the caption survives full navigations, and a
 * client-side route change never removes it because it sits outside the React root.
 */
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __demoCaptionText?: () => Promise<string>;
    __demoRenderCaption?: (text: string) => void;
  }
}

export const CAPTION_ID = "demo-caption";

const current = new WeakMap<Page, string>();

/** Call once per page, before its first navigation. */
export async function installCaptions(page: Page): Promise<void> {
  await page.exposeFunction("__demoCaptionText", () => current.get(page) ?? "");
  await page.addInitScript((id: string) => {
    window.__demoRenderCaption = (text: string) => {
      if (!document.body) return;
      let bar = document.getElementById(id);
      if (!bar) {
        bar = document.createElement("div");
        bar.id = id;
        bar.setAttribute("aria-hidden", "true");
        Object.assign(bar.style, {
          position: "fixed",
          left: "50%",
          bottom: "56px",
          transform: "translateX(-50%)",
          maxWidth: "1500px",
          padding: "18px 36px",
          borderRadius: "14px",
          background: "rgba(12, 18, 32, 0.88)",
          color: "#ffffff",
          font: "600 34px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.35)",
          zIndex: "2147483647",
          pointerEvents: "none",
        });
        document.body.appendChild(bar);
      }
      bar.textContent = text;
      bar.style.display = text ? "block" : "none";
    };
    document.addEventListener("DOMContentLoaded", () => {
      void window.__demoCaptionText?.().then((text) => window.__demoRenderCaption?.(text));
    });
  }, CAPTION_ID);
}

/** Shows `text` now (if a document is loaded) and on every later page load. */
export async function showCaption(page: Page, text: string): Promise<void> {
  current.set(page, text);
  await page.evaluate((value) => window.__demoRenderCaption?.(value), text);
}

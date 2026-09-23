/**
 * Clerk's prebuilt components styled with the DESIGN.md tokens (D-35, src/styles/tokens.css).
 * Values are the pack's hex values; the class names are the Tailwind names from tokens.css.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1e5a45",
    colorDanger: "#8a2d2d",
    colorBackground: "#ffffff",
    colorForeground: "#16181b",
    colorMutedForeground: "#5c6169",
    colorInput: "#fbf9f4",
    colorInputForeground: "#16181b",
    colorBorder: "#e3ded3",
    colorRing: "#1e5a45",
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    borderRadius: "8px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full rounded-lg border border-dashed border-border-strong bg-surface/70 shadow-none",
    headerTitle: "font-display text-ink",
    headerSubtitle: "text-ink-3",
    formButtonPrimary: "bg-accent-green hover:bg-accent-green-hover text-white",
    socialButtonsBlockButton: "border-border bg-surface-strong text-ink-2",
    dividerLine: "bg-border",
    dividerText: "font-mono uppercase text-ink-3",
    formFieldLabel: "text-ink-2",
    formFieldInput: "border-border bg-surface-strong text-ink",
    footer: "bg-transparent",
    footerActionLink: "text-accent-green hover:text-accent-green-hover",
  },
};

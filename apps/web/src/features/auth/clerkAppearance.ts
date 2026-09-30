/**
 * Clerk's prebuilt components styled with the DESIGN.md tokens (D-35, src/styles/tokens.css).
 * Values are the pack's hex values; the class names are the Tailwind names from tokens.css.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1e5a45",
    colorDanger: "#8a2d2d",
    colorBackground: "#ffffff",
    colorForeground: "#14191a",
    colorMutedForeground: "#5f6865",
    colorInput: "#fbf9f5",
    colorInputForeground: "#14191a",
    colorBorder: "#e4dfd4",
    colorRing: "#1e5a45",
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    borderRadius: "10px",
  },
  elements: {
    rootBox: "w-full",
    // Clerk's own card chrome sits inside our "Welcome back" card; inline styles beat its defaults.
    cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none", border: "0", borderRadius: "0" },
    card: "w-full border-0 bg-transparent px-0 shadow-none sm:px-2",
    headerTitle: "font-display text-ink",
    headerSubtitle: "text-ink-3",
    formButtonPrimary: "h-11 bg-accent-green hover:bg-accent-green-hover text-white",
    socialButtonsBlockButton: "h-11 border-border bg-surface-strong text-ink-2",
    dividerLine: "bg-border",
    dividerText: "font-mono uppercase text-ink-3",
    formFieldLabel: "text-ink-2",
    formFieldInput: "h-11 border-border bg-surface-strong text-ink",
    formFieldInputShowPasswordButton: "h-9 w-9",
    footer: { background: "transparent" },
    footerActionLink: "text-accent-green hover:text-accent-green-hover",
  },
};

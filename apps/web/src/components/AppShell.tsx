/**
 * The signed-in shell (design/refined-ui dashboards): a sidebar on desktop with the route mark, the
 * role's sections and an account chip; on phones a top bar with a menu and a bottom tab bar. Every
 * link goes to a page or section that already exists. The top bar is the "Primary" navigation:
 * the founder's Voice: Chloe switch and the role's main action live there on every page.
 */
import type { AccountStatus } from "@venture-route/contracts";
import {
  CalendarDays,
  CircleCheck,
  FolderKanban,
  House,
  Inbox,
  LayoutGrid,
  ListChecks,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Send,
  UserRound,
  BriefcaseBusiness,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { useMarketplaceApi } from "../api/marketplaceContext";
import { useAuthState, type Role } from "../auth/authContext";
import { FounderVoiceToggle } from "../chloe/ui/FounderVoiceToggle";
import { LogoMark } from "./Logo";
import { OfflineBanner } from "./OfflineBanner";

/** The desktop sidebar's collapsed state, remembered per browser; blocked storage means expanded. */
const SIDEBAR_KEY = "venture-route:sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // The choice only lasts for this page view.
  }
}

type NavItem = Readonly<{
  to: string;
  label: string;
  icon: LucideIcon;
  tab?: boolean;
  /** Other pages that belong to this item, so it stays highlighted (e.g. Add a project under My showcase). */
  also?: readonly string[];
}>;

const NAV: Record<Role, readonly NavItem[]> = {
  founder: [
    { to: "/dashboard", label: "Home", icon: House, tab: true },
    { to: "/dashboard#ventures", label: "Ventures", icon: FolderKanban, tab: true },
    { to: "/dashboard#bids", label: "Bids", icon: Inbox, tab: true },
    { to: "/dashboard#interviews", label: "Interviews", icon: CalendarDays, tab: true },
  ],
  builder: [
    { to: "/home", label: "Home", icon: House, tab: true },
    { to: "/profile", label: "Profile", icon: UserRound, tab: true },
    { to: "/requests", label: "Open requests", icon: BriefcaseBusiness, tab: true },
    { to: "/home#bids", label: "My bids", icon: Send, tab: true },
    { to: "/home#interviews", label: "Interviews", icon: CalendarDays },
    { to: "/my-showcase", label: "My showcase", icon: LayoutGrid, also: ["/profile/projects/new"] },
  ],
  admin: [
    { to: "/admin", label: "Queue", icon: ListChecks, tab: true },
    { to: "/admin?tab=decided", label: "Decided", icon: CircleCheck, tab: true },
  ],
};

/** Page titles shown in the top bar for the pages drawn in the new design. */
const TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/home": "Home",
  "/admin": "Review queue",
  "/profile": "Profile",
  "/my-showcase": "My showcase",
  "/profile/projects/new": "Add a project",
  "/requests": "Open requests",
  "/bookings/new": "Book an interview",
};

function titleFor(pathname: string): string | undefined {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/bookings/")) return "Interview";
  if (pathname.startsWith("/builders/")) return "Builder";
  return undefined;
}

const ROLE_LABEL: Record<Role, string> = { founder: "Founder", builder: "Builder", admin: "Admin" };
const ROLE_PILL: Record<Role, string> = {
  founder: "bg-sage text-accent-green",
  builder: "bg-project-tint text-project",
  admin: "bg-accent-on-dark/15 text-accent-on-dark",
};
const STATUS_PILL: Record<AccountStatus, [string, string]> = {
  pending: ["In review", "bg-amber-fill text-amber-ink"],
  confirmed: ["Confirmed", "bg-credential-tint text-accent-green"],
  rejected: ["Rejected", "bg-danger-tint text-danger"],
};

function initials(text: string): string {
  const parts = text.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "VR";
}

function isActive(item: NavItem, pathname: string, search: string, hash: string): boolean {
  const [path, fragment] = item.to.split("#");
  const [base, query] = (path ?? "").split("?");
  if (base !== pathname && !(item.also ?? []).includes(pathname)) return false;
  if (query) return search === `?${query}`;
  if (fragment) return hash === `#${fragment}`;
  return !hash && !search.includes("tab=");
}

/** The builder's own account status for the chip (GET /api/me/profile); null until a profile exists. */
function useBuilderStatus(role: Role | null): AccountStatus | null {
  const api = useMarketplaceApi();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  useEffect(() => {
    if (role !== "builder") return;
    let live = true;
    api
      .getProfile()
      .then((profile) => live && setStatus(profile.accountStatus))
      .catch(() => live && setStatus(null));
    return () => {
      live = false;
    };
  }, [api, role]);
  return status;
}

function AccountChip({
  role,
  status,
  dark,
  compact = false,
}: Readonly<{ role: Role; status: AccountStatus | null; dark: boolean; compact?: boolean }>) {
  const auth = useAuthState();
  const name = auth.user?.name ?? auth.user?.email ?? (role === "admin" ? "BASIX admin" : ROLE_LABEL[role]);
  if (compact) {
    const summary = [name, ROLE_LABEL[role], role === "builder" && status ? STATUS_PILL[status][0] : null].filter(Boolean);
    return (
      <div className="flex flex-col items-center gap-2">
        <span
          title={summary.join(" · ")}
          className={`grid h-10 w-10 place-items-center rounded-full text-[13px] font-semibold ${dark ? "bg-accent-green text-white" : "bg-sage text-accent-green"}`}
        >
          <span aria-hidden="true">{initials(name)}</span>
          <span className="sr-only">{summary.join(", ")}</span>
        </span>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          aria-label="Sign out"
          title="Sign out"
          className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors ${dark ? "border-border-dark text-[#cfd8d3] hover:bg-white/5" : "border-border-strong text-ink-2 hover:bg-surface"}`}
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-3.5 ${dark ? "border-border-dark bg-surface-dark-card" : "border-border bg-surface-strong"}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${dark ? "bg-accent-green text-white" : "bg-sage text-accent-green"}`}
        >
          {initials(name)}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={`truncate text-[14px] font-semibold ${dark ? "text-white" : "text-ink"}`}>{name}</span>
          <span className="flex flex-wrap gap-1.5">
            <span className={`rounded-pill px-2 py-0.5 text-[11.5px] font-medium ${ROLE_PILL[role]}`}>{ROLE_LABEL[role]}</span>
            {role === "builder" && status ? (
              <span className={`rounded-pill px-2 py-0.5 text-[11.5px] font-medium ${STATUS_PILL[status][1]}`}>
                {STATUS_PILL[status][0]}
              </span>
            ) : null}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void auth.signOut()}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium transition-colors ${dark ? "border-border-dark text-[#cfd8d3] hover:bg-white/5" : "border-border-strong text-ink-2 hover:bg-surface"}`}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

function MenuIcon({ open }: Readonly<{ open: boolean }>) {
  const line = "absolute left-0 h-[2px] w-5 rounded-full bg-current transition-all duration-200 motion-reduce:transition-none";
  return (
    <span aria-hidden="true" className="relative block h-[17px] w-5">
      <span className={`${line} top-0 ${open ? "translate-y-2 opacity-0" : ""}`} />
      <span className={`${line} top-[5px] ${open ? "top-2 rotate-45" : ""}`} />
      <span className={`${line} top-[10px] ${open ? "top-2 -rotate-45" : ""}`} />
      <span className={`${line} top-[15px] ${open ? "-translate-y-2 opacity-0" : ""}`} />
    </span>
  );
}

export function AppShell() {
  const auth = useAuthState();
  const role = auth.role ?? "founder";
  const { pathname, search, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const status = useBuilderStatus(auth.role);
  const items = NAV[role];
  const dark = role === "admin";
  const title = titleFor(pathname);

  const primaryAction =
    role === "founder" ? (
      <Link
        to="/route"
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        New route
      </Link>
    ) : role === "builder" && pathname === "/my-showcase" ? (
      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Link
          to="/showcase"
          className="inline-flex h-10 items-center rounded-xl border border-border-strong bg-surface-strong px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent-green"
        >
          View public Showcase ↗
        </Link>
        <Link
          to="/profile/projects/new"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add a project
        </Link>
      </span>
    ) : role === "builder" && pathname === "/profile" ? (
      // Submits the profile form below (the form has the matching id); the form guards a double save.
      <button
        type="submit"
        form="builder-profile-form"
        className="inline-flex h-10 items-center rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
      >
        Save changes
      </button>
    ) : role === "builder" && pathname === "/home" ? (
      <Link
        to="/profile"
        className="inline-flex h-10 items-center rounded-xl bg-accent-green px-4 text-[14px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
      >
        Edit profile
      </Link>
    ) : null;

  function toggleSidebar() {
    writeCollapsed(!collapsed);
    setCollapsed(!collapsed);
  }

  /** `rail` is the collapsed desktop sidebar: icons only, the label kept for screen readers and on hover. */
  const navLinks = (onPick?: () => void, compact = false, rail = false) =>
    items.map((item) => {
      const active = isActive(item, pathname, search, hash);
      const Icon = item.icon;
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={onPick}
          aria-current={active ? "page" : undefined}
          title={rail ? item.label : undefined}
          className={`flex items-center gap-3 rounded-xl font-medium transition-colors ${rail ? "justify-center" : "px-3.5"} ${compact ? "min-h-[48px] text-[16px]" : "h-12 text-[15px]"} ${
            active
              ? dark
                ? "bg-accent-green text-white"
                : "bg-sage text-accent-green"
              : dark
                ? "text-[#cfd8d3] hover:bg-white/5"
                : "text-ink-2 hover:bg-surface-strong"
          }`}
        >
          <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className={rail ? "sr-only" : undefined}>{item.label}</span>
        </Link>
      );
    });

  return (
    <div
      className={`min-h-screen bg-ground text-ink lg:grid ${collapsed ? "lg:grid-cols-[84px_minmax(0,1fr)]" : "lg:grid-cols-[272px_minmax(0,1fr)]"}`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-card focus:bg-surface-strong focus:px-3 focus:py-2 focus:text-ink focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      {/* The sidebar's colour runs the full page height, behind the sticky sidebar itself. */}
      <div
        aria-hidden="true"
        className={`fixed inset-y-0 left-0 hidden border-r lg:block ${collapsed ? "w-[84px]" : "w-[272px]"} ${dark ? "border-border-dark bg-dark" : "border-border bg-surface"}`}
      />
      <aside
        className={`sticky top-0 z-10 hidden h-screen flex-col gap-6 overflow-y-auto overflow-x-hidden py-6 lg:flex ${collapsed ? "px-3" : "px-4"}`}
      >
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : "justify-between"}`}>
          <Link
            to="/"
            title={collapsed ? "Venture Route" : undefined}
            className={`flex items-center gap-2.5 whitespace-nowrap font-display font-semibold tracking-tight ${collapsed ? "" : "px-2"} ${dark ? "text-[19px] text-white" : "text-[21px] text-ink"}`}
          >
            <LogoMark size={34} />
            <span className={collapsed ? "sr-only" : undefined}>Venture Route</span>
            {dark && !collapsed ? (
              <span className="rounded-pill bg-accent-on-dark/15 px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-accent-on-dark">
                Admin
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${dark ? "text-[#cfd8d3] hover:bg-white/5" : "text-ink-3 hover:bg-surface-strong hover:text-ink"}`}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
        <nav aria-label="Sections" className="flex flex-col gap-1">
          {navLinks(undefined, false, collapsed)}
          {role === "founder" ? (
            <Link
              to="/route"
              title={collapsed ? "New route" : undefined}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-accent-green/70 text-[15px] font-semibold text-accent-green transition-colors hover:bg-sage"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span className={collapsed ? "sr-only" : undefined}>New route</span>
            </Link>
          ) : null}
        </nav>
        <div className="mt-auto">
          <AccountChip role={role} status={status} dark={dark} compact={collapsed} />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pb-20 lg:pb-0">
        <OfflineBanner />
        <header
          className={`sticky top-0 z-40 border-b backdrop-blur-sm ${dark ? "border-border-dark bg-dark lg:border-border lg:bg-ground/95" : "border-border bg-ground/95"}`}
        >
          <nav aria-label="Primary" className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-10">
            <Link to="/" aria-label="Venture Route" className="grid h-11 w-11 place-items-center lg:hidden">
              <LogoMark size={32} />
            </Link>
            {title ? (
              <span
                aria-hidden="true"
                className={`font-display text-[22px] leading-none tracking-[-0.01em] lg:text-[30px] ${dark ? "text-white lg:text-ink" : "text-ink"}`}
              >
                {title}
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:block">
                <FounderVoiceToggle className="pb-0" />
              </span>
              <span className="hidden sm:inline-flex">{primaryAction}</span>
              <button
                type="button"
                aria-label="Menu"
                aria-expanded={menuOpen}
                aria-controls="app-mobile-menu"
                onClick={() => setMenuOpen((open) => !open)}
                className={`grid h-11 w-11 place-items-center rounded-lg lg:hidden ${dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/5"}`}
              >
                <MenuIcon open={menuOpen} />
              </button>
            </div>
          </nav>
          {menuOpen ? (
            <nav
              id="app-mobile-menu"
              aria-label="Mobile"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
              }}
              className="flex max-h-[calc(100dvh-4rem)] flex-col gap-4 overflow-y-auto border-t border-border bg-ground px-4 pb-6 pt-3 text-ink shadow-card lg:hidden"
            >
              <div className="flex flex-col gap-1">{navLinks(undefined, true)}</div>
              <FounderVoiceToggle className="pb-0 [&>div]:flex [&>div]:w-full [&>div>span:nth-child(2)]:flex-1" />
              {primaryAction}
              <AccountChip role={role} status={status} dark={false} />
            </nav>
          ) : null}
        </header>
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Tabs"
        className={`fixed inset-x-0 bottom-0 z-40 grid border-t lg:hidden ${dark ? "border-border-dark bg-dark" : "border-border bg-surface-strong"}`}
        style={{ gridTemplateColumns: `repeat(${items.filter((i) => i.tab).length}, minmax(0, 1fr))` }}
      >
        {items
          .filter((item) => item.tab)
          .map((item) => {
            const active = isActive(item, pathname, search, hash);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-[12px] font-medium ${
                  active ? (dark ? "text-accent-on-dark" : "text-accent-green") : dark ? "text-[#a7b8b0]" : "text-ink-3"
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                <span className="max-w-full px-1 text-center leading-[1.1]">{item.label}</span>
              </Link>
            );
          })}
      </nav>
    </div>
  );
}

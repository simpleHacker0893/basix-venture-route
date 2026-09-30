/**
 * /admin (screen 14, Stitch batch-3/admin-queue, D-36): the BASIX admin's confirmation queue.
 * Loads the pending accounts, credentials and projects; each Confirm or Reject posts the decision,
 * the engine rebuilds the MeTTa space in the same request (D-15) and answers with `projectedRows`,
 * which the status line shows as `projected_rows`. An expanded row previews the facts the row would
 * add, rendered client-side from the row's fields with the seed predicates; it is a preview, not the
 * projection itself and not a ledger. The Decided tab (spec #35 story 24, #49) lists what has already
 * been confirmed or rejected; Reverse posts the opposite decision and refreshes both lists.
 */
import type {
  AdminDecision,
  AdminDecisionKind,
  DecidedQueue,
  DecisionStatus,
  PendingAccount,
  PendingCredential,
  PendingProject,
  PendingQueue,
  PendingShowcase,
} from "@venture-route/contracts";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS, VERTICAL_LABELS } from "../../lib/brief";
import { isoDate } from "../../lib/format";
import { accountPreview, credentialPreview, projectPreview, type ProjectionPreview } from "../../lib/projection";
import { errorMessage } from "../builder/formStyles";
import { ShowcaseStatusPill, StatusPill } from "../builder/StatusPill";

type Decision = "confirm" | "reject";

type LastDecision = { decision: AdminDecision; label: string };

/** Filter pills in the design; the active one is filled ink. */
const TAB =
  "h-10 flex-none rounded-pill border border-border bg-surface-strong px-4 text-[14px] font-medium text-ink-2 data-active:border-ink data-active:bg-ink data-active:text-white data-active:shadow-none";

const TABS = ["accounts", "credentials", "projects", "showcase", "decided"] as const;
type TabValue = (typeof TABS)[number];

const KIND_LABEL: Record<AdminDecisionKind, string> = {
  account: "account",
  credential: "credential",
  project: "project",
  showcase: "showcase",
};

/** Sprint 005a (spec #86 story 15): a certification outside the nine-skill vocabulary is
 * display-only and never produces a `proves` fact (D-52). */
const NO_VOCABULARY_SKILL_BADGE = "No vocabulary skill: display only";

function SkillCell({ skillId }: Readonly<{ skillId: PendingCredential["skillId"] }>) {
  if (skillId) return <>{SKILL_LABELS[skillId]}</>;
  return (
    <span className="inline-flex h-6 items-center rounded-pill border border-border-strong bg-surface-strong px-2 font-mono text-[11px] text-ink-3">
      {NO_VOCABULARY_SKILL_BADGE}
    </span>
  );
}

function submitted(iso: string): string {
  return isoDate(iso.slice(0, 10));
}

/** How long a row has waited: "3 d" or "4 h". */
function age(iso: string, now: number): { short: string; days: number } {
  const hours = Math.max(0, Math.floor((now - Date.parse(iso)) / 36e5));
  const days = Math.floor(hours / 24);
  return { short: days >= 1 ? `${days} d` : `${Math.max(hours, 1)} h`, days };
}

/** One pending account, credential or project, as the split view's detail panel shows it. */
type QueueItem = {
  kind: Exclude<AdminDecisionKind, "showcase">;
  id: string;
  label: string;
  heading: string;
  builderId: string | null;
  submittedAt: string;
  detail: ReactNode;
  preview: ProjectionPreview;
};

const ACCENT: Record<QueueItem["kind"], string> = {
  account: "bg-surface text-ink-2 border border-border-strong",
  credential: "bg-credential-tint text-accent-green",
  project: "bg-project-tint text-project",
};

function KindPill({ kind }: Readonly<{ kind: QueueItem["kind"] }>) {
  return (
    <span className={`rounded-pill px-2.5 py-0.5 text-[12.5px] font-semibold capitalize ${ACCENT[kind]}`}>{kind}</span>
  );
}

type DecidedRowData = {
  kind: AdminDecisionKind;
  id: string;
  label: string;
  sub: string;
  builder: string;
  status: DecisionStatus;
  decidedAt: string;
};

/** Every decided row in one list, most recent decision first. */
function decidedRows(queue: DecidedQueue): DecidedRowData[] {
  const rows: DecidedRowData[] = [
    ...queue.accounts.map((account) => ({
      kind: "account" as const,
      id: account.id,
      label: account.displayName ?? account.email,
      sub: account.email,
      builder: account.builderId ?? "—",
      status: account.status,
      decidedAt: account.decidedAt,
    })),
    ...queue.credentials.map((credential) => ({
      kind: "credential" as const,
      id: credential.id,
      label: credential.title,
      sub: `${credential.issuer} · ${credential.skillId ? SKILL_LABELS[credential.skillId] : NO_VOCABULARY_SKILL_BADGE}`,
      builder: credential.displayName,
      status: credential.status,
      decidedAt: credential.decidedAt,
    })),
    ...queue.projects.map((project) => ({
      kind: "project" as const,
      id: project.id,
      label: project.title,
      sub: VERTICAL_LABELS[project.vertical],
      builder: project.displayName,
      status: project.status,
      decidedAt: project.decidedAt,
    })),
    ...queue.showcase.map((entry) => ({
      kind: "showcase" as const,
      id: entry.id,
      label: entry.title,
      sub: VERTICAL_LABELS[entry.vertical],
      builder: entry.displayName,
      status: entry.status,
      decidedAt: entry.decidedAt,
    })),
  ];
  return rows.sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt));
}

export function AdminHome() {
  const api = useMarketplaceApi();
  const [queue, setQueue] = useState<PendingQueue | null>(null);
  const [decided, setDecided] = useState<DecidedQueue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [last, setLast] = useState<LastDecision | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The open tab lives in the URL (?tab=decided) so the shell's Queue / Decided links select it.
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const initialTab: TabValue = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabValue) : "accounts";

  useEffect(() => {
    let cancelled = false;
    api
      .getPending()
      .then((next) => {
        if (!cancelled) setQueue(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "The queue could not be loaded."));
      });
    api
      .getDecided()
      .then((next) => {
        if (!cancelled) setDecided(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "The decided list could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function decide(decision: Decision, kind: AdminDecisionKind, id: string, label: string) {
    setBusy(id);
    setActionError(null);
    try {
      const result = decision === "confirm" ? await api.confirm(kind, id) : await api.reject(kind, id);
      setQueue((current) => {
        if (!current) return current;
        return {
          accounts: kind === "account" ? current.accounts.filter((row) => row.id !== id) : current.accounts,
          credentials: kind === "credential" ? current.credentials.filter((row) => row.id !== id) : current.credentials,
          projects: kind === "project" ? current.projects.filter((row) => row.id !== id) : current.projects,
          showcase: kind === "showcase" ? current.showcase.filter((row) => row.id !== id) : current.showcase,
        };
      });
      setExpanded((current) => (current === id ? null : current));
      setLast({ decision: result, label });
      setDecided(await api.getDecided());
    } catch (cause) {
      setActionError(errorMessage(cause, `The ${KIND_LABEL[kind]} decision could not be saved.`));
      // A 409 means the builder withdrew the entry after the queue loaded (spec #86 story 56);
      // refresh so the stale row is no longer offered.
      api
        .getPending()
        .then(setQueue)
        .catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  /** Reverse posts the opposite decision (reject a confirmed row, confirm a rejected one) and
   * reloads both lists: the engine reprojects in the same request and answers `projectedRows`. */
  async function reverse(row: DecidedRowData) {
    setBusy(row.id);
    setActionError(null);
    try {
      const result =
        row.status === "confirmed" ? await api.reject(row.kind, row.id) : await api.confirm(row.kind, row.id);
      setLast({ decision: result, label: row.label });
      const [nextPending, nextDecided] = await Promise.all([api.getPending(), api.getDecided()]);
      setQueue(nextPending);
      setDecided(nextDecided);
    } catch (cause) {
      setActionError(errorMessage(cause, `The ${KIND_LABEL[row.kind]} decision could not be reversed.`));
    } finally {
      setBusy(null);
    }
  }

  const counts = {
    accounts: queue?.accounts.length ?? 0,
    credentials: queue?.credentials.length ?? 0,
    projects: queue?.projects.length ?? 0,
    showcase: queue?.showcase.length ?? 0,
  };
  const total = counts.accounts + counts.credentials + counts.projects + counts.showcase;
  const decidedList = decided ? decidedRows(decided) : [];

  const rowProps = (kind: AdminDecisionKind, id: string, label: string, submittedAt: string) => ({
    kind,
    id,
    label,
    age: age(submittedAt, now).short,
    busy: busy === id,
    expanded: expanded === id,
    onToggle: () => setExpanded((current) => (current === id ? null : id)),
    onDecide: (decision: Decision) => decide(decision, kind, id, label),
  });

  const [now] = useState(() => Date.now());
  const items: QueueItem[] = queue
    ? [
        ...queue.accounts.map((account) => ({
          kind: "account" as const,
          id: account.id,
          label: account.displayName ?? account.email,
          heading: account.displayName ?? account.email,
          builderId: account.builderId,
          submittedAt: account.submittedAt,
          detail: <AccountDetail account={account} />,
          preview: accountPreview(account),
        })),
        ...queue.credentials.map((credential) => ({
          kind: "credential" as const,
          id: credential.id,
          label: credential.title,
          heading: `${credential.displayName} · ${credential.skillId ? SKILL_LABELS[credential.skillId] : credential.title}`,
          builderId: credential.builderId,
          submittedAt: credential.submittedAt,
          detail: <CredentialDetail credential={credential} />,
          preview: credentialPreview(credential),
        })),
        ...queue.projects.map((project) => ({
          kind: "project" as const,
          id: project.id,
          label: project.title,
          heading: `${project.displayName} · ${project.title}`,
          builderId: project.builderId,
          submittedAt: project.submittedAt,
          detail: <ProjectDetail project={project} />,
          preview: projectPreview(project),
        })),
      ]
    : [];
  const selected = items.find((item) => item.id === expanded) ?? null;
  const pendingOf = (list: readonly { submittedAt: string }[]) => {
    const oldest = list.reduce<string | null>((min, row) => (min === null || row.submittedAt < min ? row.submittedAt : min), null);
    return oldest ? age(oldest, now).days : null;
  };
  const today = new Date(now).toDateString();
  const decidedToday = decidedList.filter((row) => new Date(row.decidedAt).toDateString() === today);
  const confirmedToday = decidedToday.filter((row) => row.status === "confirmed").length;
  const otherRecords = selected?.builderId
    ? [
        ...items
          .filter((item) => item.builderId === selected.builderId && item.id !== selected.id)
          .map((item) => ({ key: item.id, label: `${item.kind === "account" ? "Account" : item.label}`, status: "pending" as const })),
        ...(decided ? decidedRows(decided) : [])
          .filter((row) => row.builder === selected.builderId || (decided?.accounts.find((a) => a.id === row.id)?.builderId ?? null) === selected.builderId)
          .map((row) => ({ key: row.id, label: row.kind === "account" ? "Account" : row.label, status: row.status })),
      ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <h1 className="sr-only">Review queue</h1>
      <p className="max-w-3xl text-[14px] leading-relaxed text-ink-3">
        Only confirmed accounts, credentials and projects appear in routes and bids. Each decision rebuilds the MeTTa
        space in the same request; <code className="font-mono">projected_rows</code> is the atom count after the rebuild.
        <span className="ml-1 font-mono text-[12.5px] text-ink-2">
          Showing <span className="font-semibold text-ink">{total}</span> pending review
        </span>
      </p>

      {queue ? (
        <section aria-label="Queue summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(
            [
              ["Accounts", counts.accounts, pendingOf(queue.accounts)],
              ["Credentials", counts.credentials, pendingOf(queue.credentials)],
              ["Projects + Showcase", counts.projects + counts.showcase, pendingOf([...queue.projects, ...queue.showcase])],
            ] as const
          ).map(([label, count, oldest]) => (
            <div key={label} className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-strong px-5 py-4">
              <span className="text-[14px] text-ink-2">{label}</span>
              <span className="font-display text-[34px] leading-none text-ink">{count}</span>
              <span className={`text-[13.5px] ${oldest !== null && oldest >= 2 ? "font-semibold text-amber-ink" : "text-ink-3"}`}>
                {count === 0 ? "none pending" : oldest !== null && oldest >= 1 ? `oldest ${oldest} ${oldest === 1 ? "day" : "days"}` : "pending"}
              </span>
            </div>
          ))}
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface-strong px-5 py-4">
            <span className="text-[14px] text-ink-2">Decided today</span>
            <span className="font-display text-[34px] leading-none text-ink">{decidedToday.length}</span>
            <span className="text-[13.5px] text-ink-3">
              {confirmedToday} confirmed · {decidedToday.length - confirmedToday} rejected
            </span>
          </div>
        </section>
      ) : null}

      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}
      {queue === null && loadError === null ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading the queue…
        </p>
      ) : null}

      {last ? (
        <p
          role="status"
          aria-label="Last decision"
          className="rounded-card border border-accent-green/40 bg-surface-strong px-3 py-2 font-mono text-[13px] text-ink"
        >
          {last.decision.status === "confirmed" ? "Confirmed" : "Rejected"} {KIND_LABEL[last.decision.kind]} "{last.label}" ·
          projected_rows: {last.decision.projectedRows}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {actionError}
        </p>
      ) : null}

      {queue ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Tabs
            value={initialTab}
            onValueChange={(value) => setParams(value === "accounts" ? {} : { tab: String(value) }, { replace: true })}
            className="gap-4"
          >
            <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
              <TabsTrigger value="accounts" className={TAB}>
                <span>Accounts</span>
                <Count value={counts.accounts} />
              </TabsTrigger>
              <TabsTrigger value="credentials" className={TAB}>
                <span>Credentials</span>
                <Count value={counts.credentials} />
              </TabsTrigger>
              <TabsTrigger value="projects" className={TAB}>
                <span>Projects</span>
                <Count value={counts.projects} />
              </TabsTrigger>
              <TabsTrigger value="showcase" className={TAB}>
                <span>Showcase ({counts.showcase})</span>
              </TabsTrigger>
              <TabsTrigger value="decided" className={TAB}>
                <span>Decided</span>
                <Count value={decidedList.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts">
              <QueueTable
                caption="Pending accounts"
                columns={["Name", "Role", "Cohort", "Submitted", "Actions"]}
                empty="No pending accounts."
                rows={queue.accounts.map((account) => (
                  <QueueRow
                    key={account.id}
                    {...rowProps("account", account.id, account.displayName ?? account.email, account.submittedAt)}
                    cells={[
                      <RoleCell key="role" role={account.role} />,
                      account.cohortId ?? "—",
                      submitted(account.submittedAt),
                    ]}
                    sub={account.email}
                  />
                ))}
              />
            </TabsContent>
            <TabsContent value="credentials">
              <QueueTable
                caption="Pending credentials"
                columns={["Credential", "Builder", "Skill", "Submitted", "Actions"]}
                empty="No pending credentials."
                rows={queue.credentials.map((credential) => (
                  <QueueRow
                    key={credential.id}
                    {...rowProps("credential", credential.id, credential.title, credential.submittedAt)}
                    cells={[
                      credential.displayName,
                      <SkillCell key="skill" skillId={credential.skillId} />,
                      submitted(credential.submittedAt),
                    ]}
                    sub={credential.issuer}
                  />
                ))}
              />
            </TabsContent>
            <TabsContent value="projects">
              <QueueTable
                caption="Pending projects"
                columns={["Project", "Builder", "Vertical", "Submitted", "Actions"]}
                empty="No pending projects."
                rows={queue.projects.map((project) => (
                  <QueueRow
                    key={project.id}
                    {...rowProps("project", project.id, project.title, project.submittedAt)}
                    cells={[project.displayName, VERTICAL_LABELS[project.vertical], submitted(project.submittedAt)]}
                    sub={project.licensable ? "Licensable as reusable IP" : "Not licensable"}
                  />
                ))}
              />
            </TabsContent>
            <TabsContent value="showcase">
              <ShowcaseQueueList
                entries={queue.showcase}
                busyId={busy}
                onDecide={(decision, entry) => decide(decision, "showcase", entry.id, entry.title)}
              />
            </TabsContent>
            <TabsContent value="decided">
              <QueueTable
                caption="Decided accounts, credentials, projects and showcase entries"
                columns={["Item", "Kind", "Builder", "Status", "Decided", "Actions"]}
                empty="Nothing has been decided yet."
                noun="decided"
                rows={decidedList.map((row) => (
                  <DecidedRow key={row.id} row={row} busy={busy === row.id} onReverse={() => reverse(row)} />
                ))}
              />
            </TabsContent>
          </Tabs>

          <DetailPanel selected={selected} otherRecords={otherRecords} now={now} />
        </div>
      ) : null}
    </div>
  );
}

function Count({ value }: Readonly<{ value: number }>) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-surface-strong px-1.5 font-mono text-[11px] text-ink-2">
      {value}
    </span>
  );
}

function RoleCell({ role }: Readonly<{ role: PendingAccount["role"] }>) {
  return (
    <span className="inline-flex h-6 items-center rounded-pill border border-border-strong px-2.5 text-[12px] text-ink-2">
      {role === "builder" ? "Builder" : role === "founder" ? "Founder" : "No role yet"}
    </span>
  );
}

function QueueTable({
  caption,
  columns,
  rows,
  empty,
  noun = "pending",
}: Readonly<{ caption: string; columns: readonly string[]; rows: React.ReactNode[]; empty: string; noun?: string }>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface-strong">
        <table className="w-full text-[14px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border bg-surface font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`px-3 py-3 text-left font-medium first:pl-4 ${index > 0 && index < columns.length - 1 && noun === "pending" ? "max-sm:hidden" : ""}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length > 0 ? (
              rows
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-ink-muted">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <span className="font-mono text-[12px] text-ink-3">
        {rows.length} of {rows.length} {noun}
      </span>
    </div>
  );
}

function QueueRow({
  id,
  label,
  sub,
  cells,
  age: waited,
  busy,
  expanded,
  onToggle,
  onDecide,
}: Readonly<{
  id: string;
  kind: AdminDecisionKind;
  label: string;
  sub: string;
  cells: React.ReactNode[];
  age: string;
  busy: boolean;
  expanded: boolean;
  onToggle(): void;
  onDecide(decision: Decision): void;
}>) {
  const panelId = `row-${id}`;
  return (
    <>
      <tr aria-label={label} className={`align-top transition-colors ${expanded ? "bg-sage/70 shadow-[inset_3px_0_0_var(--vr-accent)]" : ""}`}>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-label={expanded ? "Collapse row" : "Expand row"}
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              onClick={onToggle}
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-strong font-mono text-[13px] text-ink-3 hover:border-accent-green hover:text-accent-green"
            >
              <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            </button>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{label}</span>
                <DemoDataPill />
              </div>
              <span className="text-[13px] text-ink-3">
                {sub} · waiting {waited}
              </span>
            </div>
          </div>
        </td>
        {cells.map((cell, index) => (
          <td key={index} className="px-3 py-3 text-ink-2 max-sm:hidden">
            {cell}
          </td>
        ))}
        <td className="px-3 py-3 pr-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("confirm")}
              className="inline-flex h-8 items-center rounded-lg bg-accent-green px-3 text-[13px] font-medium text-white hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("reject")}
              className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface-strong px-3 text-[13px] font-medium text-danger hover:border-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </td>
      </tr>

    </>
  );
}

function DecidedRow({
  row,
  busy,
  onReverse,
}: Readonly<{ row: DecidedRowData; busy: boolean; onReverse(): void }>) {
  return (
    <tr aria-label={row.label} className="align-top">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{row.label}</span>
            <DemoDataPill />
          </div>
          <span className="text-[12px] text-ink-3">{row.sub}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-2">{KIND_LABEL[row.kind]}</td>
      <td className="px-4 py-3 text-ink-2">{row.builder}</td>
      <td className="px-4 py-3">
        <StatusPill status={row.status} />
      </td>
      <td className="px-4 py-3 text-ink-2">{submitted(row.decidedAt)}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={onReverse}
          title={row.status === "confirmed" ? "Reject this row" : "Confirm this row"}
          className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface-strong px-3 text-[13px] font-medium text-ink hover:border-accent-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reverse
        </button>
      </td>
    </tr>
  );
}

/**
 * Sprint 005a (spec #86 stories 48-49, #106): a Showcase entry's card preview in the admin queue.
 * Links are plain text, not clickable anchors that auto-open, with the host highlighted; the
 * video id is the one the engine already parsed out of `pitchVideoUrl` (#89), never re-parsed
 * here. Confirm/Reject act on this entry's own `showcaseStatus`, independent of the project's
 * confirmation (#103).
 */
const SHOWCASE_LINKS: ReadonlyArray<{ field: keyof PendingShowcase; label: string }> = [
  { field: "liveUrl", label: "Live" },
  { field: "demoUrl", label: "Demo" },
  { field: "pitchVideoUrl", label: "Pitch video" },
  { field: "pitchDeckUrl", label: "Pitch deck" },
];

/** A URL as plain text with its host highlighted; never an `<a>`, so it cannot auto-open. */
function LinkText({ url }: Readonly<{ url: string }>) {
  let before = "";
  let host = url;
  let after = "";
  try {
    host = new URL(url).host;
    const at = url.indexOf(host);
    before = url.slice(0, at);
    after = url.slice(at + host.length);
  } catch {
    // Not a parseable URL: show it verbatim with nothing highlighted.
  }
  return (
    <span className="break-all font-mono text-[12px] text-ink-2">
      {before}
      <span className="font-semibold text-ink">{host}</span>
      {after}
    </span>
  );
}

function ShowcaseQueueList({
  entries,
  busyId,
  onDecide,
}: Readonly<{
  entries: PendingShowcase[];
  busyId: string | null;
  onDecide(decision: Decision, entry: PendingShowcase): void;
}>) {
  return (
    <div className="flex flex-col gap-3">
      {entries.length > 0 ? (
        entries.map((entry) => <ShowcaseEntryCard key={entry.id} entry={entry} busy={busyId === entry.id} onDecide={onDecide} />)
      ) : (
        <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-ink-muted">
          No pending Showcase entries.
        </p>
      )}
    </div>
  );
}

function ShowcaseEntryCard({
  entry,
  busy,
  onDecide,
}: Readonly<{ entry: PendingShowcase; busy: boolean; onDecide(decision: Decision, entry: PendingShowcase): void }>) {
  const links = SHOWCASE_LINKS.map(({ field, label }) => ({ label, url: entry[field] as string | null })).filter(
    (link): link is { label: string; url: string } => link.url !== null,
  );
  return (
    <article aria-label={entry.title} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">{entry.title}</h3>
            <DemoDataPill />
          </div>
          <span className="text-[12px] text-ink-3">
            {entry.displayName} · {VERTICAL_LABELS[entry.vertical]}
          </span>
        </div>
        <ShowcaseStatusPill status={entry.showcaseStatus} />
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">{entry.description}</p>

      {entry.projectStatus !== "confirmed" || !entry.accountConfirmed ? (
        <div className="flex flex-wrap gap-2">
          {entry.projectStatus !== "confirmed" ? (
            <span className="rounded-pill border border-amber-ink/40 bg-amber-fill px-2.5 py-1 text-[12px] font-medium text-amber-ink">
              Project not yet confirmed
            </span>
          ) : null}
          {!entry.accountConfirmed ? (
            <span className="rounded-pill border border-amber-ink/40 bg-amber-fill px-2.5 py-1 text-[12px] font-medium text-amber-ink">
              Account not confirmed
            </span>
          ) : null}
        </div>
      ) : null}

      {links.length > 0 ? (
        <dl className="grid grid-cols-1 gap-1.5 border-t border-border pt-3 sm:grid-cols-2">
          {links.map((link) => (
            <div key={link.label} className="flex flex-col gap-0.5">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{link.label}</dt>
              <dd>
                <LinkText url={link.url} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="font-mono text-[12px] text-ink-3">
        {entry.pitchVideoId ? <>Video id: {entry.pitchVideoId}</> : "No pitch video"}
      </p>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide("confirm", entry)}
          className="inline-flex h-8 items-center rounded-lg bg-accent-green px-3 text-[13px] font-medium text-white hover:bg-accent-green-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide("reject", entry)}
          className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface-strong px-3 text-[13px] font-medium text-danger hover:border-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </article>
  );
}

/**
 * The split view's right side: the selected pending row's submitted evidence, the builder's other
 * records from the two queues, and the facts the row would add on confirmation (client-side
 * preview from `lib/projection.ts`, not the projection itself). With nothing selected it explains
 * what confirming means. Decisions stay on the row; reversing lives in the Decided tab.
 */
function DetailPanel({
  selected,
  otherRecords,
  now,
}: Readonly<{
  selected: QueueItem | null;
  otherRecords: ReadonlyArray<{ key: string; label: string; status: "pending" | DecisionStatus }>;
  now: number;
}>) {
  if (!selected) {
    return (
      <aside
        aria-label="What confirming means"
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-6 xl:sticky xl:top-24"
      >
        <h2 className="font-display text-[22px] text-ink">What confirming means</h2>
        <p className="text-[14px] text-ink-3">Open a row with + to see its evidence and the facts it adds to the MeTTa graph.</p>
        <ul className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink-2">
          <li>
            <strong className="text-ink">Accounts:</strong> appear in routes and can bid on venture requests.
          </li>
          <li>
            <strong className="text-ink">Credentials:</strong> become proof for the skill they name (
            <code className="font-mono">verified-for-skill</code>, evidence credential).
          </li>
          <li>
            <strong className="text-ink">Projects:</strong> become proof for their skills and, if licensable, reusable IP (
            <code className="font-mono">reuse-fit</code>).
          </li>
        </ul>
        <p className="border-t border-border pt-3 text-[12.5px] leading-relaxed text-ink-3">
          Every decision reprojects the graph; the same count is on <code className="font-mono">GET /health</code> as{" "}
          <code className="font-mono">projected_rows</code>. A mistaken decision is reversed from the Decided tab; every step
          stays in the confirmations log.
        </p>
      </aside>
    );
  }
  const waited = age(selected.submittedAt, now);
  return (
    <aside
      id={`row-${selected.id}`}
      aria-label={`${selected.label} detail`}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-surface-strong p-6 xl:sticky xl:top-24"
    >
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <KindPill kind={selected.kind} />
          <DemoDataPill />
        </span>
        <h2 className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">{selected.heading}</h2>
        <span className="text-[14px] text-ink-3">
          Submitted {waited.days >= 1 ? `${waited.days} ${waited.days === 1 ? "day" : "days"}` : waited.short.replace(" h", " hours")} ago
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <section aria-label="Submitted evidence" className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-2">Submitted evidence</span>
          {selected.detail}
        </section>
        <section aria-label="Builder's other records" className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <span className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-2">Builder's other records</span>
          {otherRecords.length === 0 ? (
            <p className="text-[14px] text-ink-3">No other records in the queue or the decided log.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {otherRecords.map((record) => (
                <li key={record.key} className="flex items-center justify-between gap-3 text-[14px] text-ink">
                  <span className="truncate">{record.label}</span>
                  {record.status === "pending" ? (
                    <span className="rounded-pill bg-amber-fill px-2.5 py-0.5 text-[12.5px] font-medium text-amber-ink">Pending</span>
                  ) : (
                    <StatusPill status={record.status} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section aria-label="Projection preview" className="flex flex-col gap-3 rounded-2xl bg-dark p-5 font-mono text-[13px] text-accent-on-dark">
        <span className="text-[11.5px] uppercase tracking-[0.12em] text-ledger-dim">If confirmed, this enters the MeTTa graph</span>
        {selected.preview.facts.length > 0 ? (
          <ul translate="no" className="flex flex-col gap-1.5">
            {selected.preview.facts.map((fact) => (
              <li key={fact} className="rounded-lg border border-border-dark bg-surface-dark-card px-3.5 py-2.5 text-[14px] text-[#f3f1ea]">
                {fact}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ledger-dim">(no facts)</p>
        )}
        <p className="font-sans text-[13px] text-ledger-dim">{selected.preview.note}</p>
      </section>
      <p className="border-t border-border pt-4 text-[13.5px] text-ink-3">
        Confirm or reject from the row. Every decision can be reversed from the Decided tab.
      </p>
    </aside>
  );
}

function DetailGrid({ items }: Readonly<{ items: readonly { label: string; value: React.ReactNode }[] }>) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-3">{item.label}</dt>
          <dd className="text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AccountDetail({ account }: Readonly<{ account: PendingAccount }>) {
  return (
    <DetailGrid
      items={[
        { label: "Email", value: account.email },
        { label: "Clerk id", value: <span translate="no" className="font-mono text-[13px]">{account.clerkId}</span> },
        { label: "Builder id", value: account.builderId ?? "—" },
        { label: "Cohort", value: account.cohortId ?? "—" },
      ]}
    />
  );
}

function CredentialDetail({ credential }: Readonly<{ credential: PendingCredential }>) {
  return (
    <DetailGrid
      items={[
        { label: "Credential", value: credential.title },
        { label: "Issuer", value: credential.issuer },
        { label: "Builder", value: `${credential.displayName} (${credential.builderId})` },
        {
          label: "Skill",
          value: <SkillCell skillId={credential.skillId} />,
        },
      ]}
    />
  );
}

function ProjectDetail({ project }: Readonly<{ project: PendingProject }>) {
  return (
    <DetailGrid
      items={[
        { label: "Project", value: project.title },
        { label: "Builder", value: `${project.displayName} (${project.builderId})` },
        { label: "Vertical", value: VERTICAL_LABELS[project.vertical] },
        { label: "Completed", value: isoDate(project.completedOn) },
        { label: "Skills", value: project.skillIds.map((skill) => SKILL_LABELS[skill]).join(", ") },
        { label: "Licensable", value: project.licensable ? "Yes" : "No" },
      ]}
    />
  );
}

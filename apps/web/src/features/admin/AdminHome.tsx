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
import { useEffect, useState } from "react";

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

  const rowProps = (kind: AdminDecisionKind, id: string, label: string, preview: ProjectionPreview) => ({
    kind,
    id,
    label,
    preview,
    busy: busy === id,
    expanded: expanded === id,
    onToggle: () => setExpanded((current) => (current === id ? null : id)),
    onDecide: (decision: Decision) => decide(decision, kind, id, label),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
        <span className="text-ink-3">Registry</span>
        <span aria-hidden="true" className="text-border-strong">
          /
        </span>
        <span className="font-medium text-ink">Confirmation queue</span>
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-semibold text-ink">Confirmation queue</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            Only confirmed accounts, credentials, and projects appear in routes and bids. Each decision rebuilds the MeTTa
            space from confirmed rows in the same request; <code className="font-mono">projected_rows</code> is the atom
            count after the rebuild.
          </p>
        </div>
        <span className="font-mono text-[12px] text-ink-3">
          Showing <span className="font-medium text-ink">{total}</span> pending review
        </span>
      </header>

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Tabs defaultValue="accounts" className="gap-4">
            <TabsList variant="line" className="border-b border-border">
              <TabsTrigger value="accounts" className="gap-2 px-3">
                <span>Accounts</span>
                <Count value={counts.accounts} />
              </TabsTrigger>
              <TabsTrigger value="credentials" className="gap-2 px-3">
                <span>Credentials</span>
                <Count value={counts.credentials} />
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2 px-3">
                <span>Projects</span>
                <Count value={counts.projects} />
              </TabsTrigger>
              <TabsTrigger value="showcase" className="gap-2 px-3">
                <span>Showcase ({counts.showcase})</span>
              </TabsTrigger>
              <TabsTrigger value="decided" className="gap-2 px-3">
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
                    {...rowProps("account", account.id, account.displayName ?? account.email, accountPreview(account))}
                    detail={<AccountDetail account={account} />}
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
                    {...rowProps("credential", credential.id, credential.title, credentialPreview(credential))}
                    detail={<CredentialDetail credential={credential} />}
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
                    {...rowProps("project", project.id, project.title, projectPreview(project))}
                    detail={<ProjectDetail project={project} />}
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

          <aside className="flex flex-col gap-6">
            <section aria-label="What confirming means" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6">
              <h2 className="font-display text-xl font-semibold text-ink">What confirming means</h2>
              <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-ink-2">
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
              <p className="border-t border-border pt-3 text-[12px] text-ink-3">
                Every decision reprojects the graph; the same count is on <code className="font-mono">GET /health</code> as{" "}
                <code className="font-mono">projected_rows</code>. A mistaken decision is reversed from the Decided tab; every
                step stays in the confirmations log.
              </p>
            </section>
          </aside>
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
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border font-mono text-[11px] uppercase tracking-wider text-ink-3">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 text-left font-medium">
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
  kind,
  label,
  sub,
  cells,
  detail,
  preview,
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
  detail: React.ReactNode;
  preview: ProjectionPreview;
  busy: boolean;
  expanded: boolean;
  onToggle(): void;
  onDecide(decision: Decision): void;
}>) {
  const panelId = `row-${id}`;
  return (
    <>
      <tr aria-label={label} className="align-top">
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-label={expanded ? "Collapse row" : "Expand row"}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={onToggle}
              className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-border-strong font-mono text-[11px] text-ink-3 hover:border-accent-green"
            >
              <span aria-hidden="true">{expanded ? "−" : "+"}</span>
            </button>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{label}</span>
                <DemoDataPill />
              </div>
              <span className="text-[12px] text-ink-3">{sub}</span>
            </div>
          </div>
        </td>
        {cells.map((cell, index) => (
          <td key={index} className="px-4 py-3 text-ink-2">
            {cell}
          </td>
        ))}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
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
      {expanded ? (
        <tr id={panelId}>
          <td colSpan={cells.length + 2} className="bg-surface-strong px-4 py-4">
            <div className="flex flex-col gap-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                {KIND_LABEL[kind]} detail · submitted for confirmation
              </span>
              {detail}
              <section
                aria-label="Projection preview"
                className="flex flex-col gap-2 rounded-card bg-dark p-4 font-mono text-[13px] text-accent-on-dark"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-ledger-dim">
                  <span>MeTTa fact projection · preview</span>
                  <span>facts this row would add on confirmation</span>
                </div>
                {preview.facts.length > 0 ? (
                  <ul translate="no" className="flex flex-col gap-0.5">
                    {preview.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-ledger-dim">(no facts)</p>
                )}
                <p className="text-[12px] text-ledger-dim">{preview.note}</p>
              </section>
            </div>
          </td>
        </tr>
      ) : null}
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
      <span className="font-mono text-[12px] text-ink-3">
        {entries.length} of {entries.length} pending
      </span>
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

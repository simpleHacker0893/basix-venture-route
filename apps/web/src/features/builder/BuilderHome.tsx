/**
 * /home (design/refined-ui builder dashboard): where a builder stands and what to do next. It only
 * reads what the app already loads: the profile and its account status, credentials and projects,
 * the open requests with the engine's own eligibility verdict for this builder (D-45), the
 * builder's bids and bookings. Nothing here matches skills: a request is shown as eligible only
 * when the engine says so, and otherwise with the engine's reason (AGENTS.md rule 1). Self-described
 * skills are shown as display-only (rule 4); seed records carry the Demo data pill (rule 5).
 *
 * The page renders in two stages. The profile, evidence, bids and bookings are plain reads and
 * show as soon as they arrive. The open requests carry a MeTTa verdict per request, which is the
 * slow call, so they load on their own and the rest of the page never waits for them.
 */
import type {
  Bid,
  Booking,
  BuilderProfile,
  Credential,
  DeliveryMode,
  Request,
  ShowcaseProject,
} from "@venture-route/contracts";
import { ArrowRight, Check, Clock3, Lock, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { ApiNotFoundError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { SKILL_LABELS } from "../../lib/brief";
import { usd } from "../../lib/format";
import { formatNairobi } from "../../lib/nairobi";
import { errorMessage } from "./formStyles";
import { ShowcaseStatusPill } from "./StatusPill";

type Snapshot = Readonly<{
  profile: BuilderProfile | null;
  credentials: Credential[];
  projects: ShowcaseProject[];
  bids: Bid[];
  bookings: Booking[];
}>;

const MODE_LABEL: Record<DeliveryMode, string> = { remote: "Remote", hybrid: "Hybrid", "on-site": "On-site" };
const STATE_LABEL: Record<Booking["state"], string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  countered: "Countered",
  confirmed: "Confirmed",
};
const STATE_PILL: Record<Booking["state"], string> = {
  proposed: "bg-surface text-ink-2 border border-border-strong",
  accepted: "bg-project-tint text-project",
  countered: "bg-amber-fill text-amber-ink",
  confirmed: "bg-credential-tint text-accent-green",
};

function orNotFound<T>(fallback: T): (cause: unknown) => T {
  return (cause) => {
    if (cause instanceof ApiNotFoundError) return fallback;
    throw cause;
  };
}

type StepState = "done" | "review" | "rejected" | "todo" | "locked";

function StepIcon({ state }: Readonly<{ state: StepState }>) {
  if (state === "done") {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-green text-white">
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === "review") {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-amber-ink bg-amber-fill text-amber-ink">
        <Clock3 className="h-4 w-4" />
      </span>
    );
  }
  if (state === "rejected") {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-danger bg-danger-tint text-danger">
        <X className="h-4 w-4" />
      </span>
    );
  }
  if (state === "locked") {
    return (
      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-border-strong bg-surface-strong text-ink-3">
        <Lock className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span className="h-8 w-8 rounded-full border-2 border-border-strong bg-surface-strong" />;
}

function ProgressRing({ done, total }: Readonly<{ done: number; total: number }>) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative grid h-40 w-40 shrink-0 place-items-center">
      <svg aria-hidden="true" viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" strokeWidth="14" className="stroke-border" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          className="stroke-accent-green"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - done / total)}
        />
      </svg>
      <span className="flex flex-col items-center">
        <span className="font-display text-[40px] leading-none text-ink">
          {done} / {total}
        </span>
        <span className="mt-1 text-[13px] text-ink-3">steps done</span>
      </span>
    </div>
  );
}

function EmptyBox({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border-strong px-5 py-5">
      <span className="text-[15px] font-semibold text-ink">{title}</span>
      <span className="text-[14px] leading-relaxed text-ink-3">{body}</span>
    </div>
  );
}

export function BuilderHome() {
  const api = useMarketplaceApi();
  const [data, setData] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // null while the open requests are still loading (stage two); [] once they are in and empty.
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Stage one: everything that is a plain read.
    Promise.all([
      api.getProfile().catch(orNotFound<BuilderProfile | null>(null)),
      api.listCredentials().catch(orNotFound<Credential[]>([])),
      api.listProjects().catch(orNotFound<ShowcaseProject[]>([])),
      api.listMyBids().catch(orNotFound<Bid[]>([])),
      api.listMyBookings().catch(orNotFound<Booking[]>([])),
    ])
      .then(([profile, credentials, projects, bids, bookings]) => {
        if (!cancelled) setData({ profile, credentials, projects, bids, bookings });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "Your home could not be loaded."));
      });
    // Stage two: started at the same time, shown whenever it lands. A failure here only affects
    // the requests section; it no longer blanks the whole page.
    api
      .listRequests()
      .catch(orNotFound<Request[]>([]))
      .then((list) => {
        if (!cancelled) setRequests(list);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setRequestsError(errorMessage(cause, "Open requests could not be loaded."));
        setRequests([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10">
        <h1 className="sr-only">Home</h1>
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10">
        <h1 className="sr-only">Home</h1>
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading your home…
        </p>
      </div>
    );
  }

  const { profile, credentials, projects, bids, bookings } = data;
  const requestsLoading = requests === null;
  const evidence = [...credentials, ...projects];
  const status = profile?.accountStatus ?? null;
  const open = (requests ?? []).filter((r) => r.status === "open");
  const eligible = open.filter((r) => r.eligibility?.eligible === true);
  const confirmed = status === "confirmed";

  const steps: ReadonlyArray<{ label: string; state: StepState; pill?: string }> = [
    { label: profile ? "Profile complete" : "Complete your profile", state: profile ? "done" : "todo" },
    { label: evidence.length > 0 ? "Credential or project added" : "Add a credential or project", state: evidence.length > 0 ? "done" : "todo" },
    {
      label: "Confirmed by BASIX admin",
      state: status === "confirmed" ? "done" : status === "pending" ? "review" : status === "rejected" ? "rejected" : "todo",
      pill: status === "pending" ? "In review" : status === "rejected" ? "Rejected" : undefined,
    },
    {
      label: "Eligible for requests",
      state: eligible.length > 0 ? "done" : "locked",
      pill: requestsLoading ? "Checking…" : undefined,
    },
  ];
  const done = steps.filter((s) => s.state === "done").length;
  const pendingEvidence = evidence.find((e) => e.status === "pending");

  const next: { title: string; body: string; cta: string; to: string } = !profile
    ? { title: "Start with your profile.", body: "Add who you are, your day rate and when you are available.", cta: "Complete your profile", to: "/profile" }
    : evidence.length === 0
      ? {
          title: "Add proof for a skill.",
          body: "A confirmed credential or completed project is what makes a skill count for routing.",
          cta: "Add a project",
          to: "/profile/projects/new",
        }
      : status === "pending"
        ? {
            title: "BASIX is reviewing your account.",
            body: "You are absent from routes and bids until a BASIX admin confirms it. Meanwhile, add a project to strengthen your evidence.",
            cta: "Add a project",
            to: "/profile/projects/new",
          }
        : status === "rejected"
          ? { title: "Your account was not confirmed.", body: "Check your profile details and evidence.", cta: "Review your profile", to: "/profile" }
          : requestsLoading
            ? {
                title: "Checking open requests…",
                body: "The engine is checking which requests fit your verified skills, availability and delivery mode.",
                cta: "See open requests",
                to: "/requests",
              }
            : eligible.length > 0
            ? {
                title: `You're eligible for ${eligible.length} ${eligible.length === 1 ? "request" : "requests"}.`,
                body: "The engine checked your verified skills, availability and delivery mode.",
                cta: "See open requests",
                to: "/requests",
              }
            : pendingEvidence
              ? {
                  title: `BASIX is reviewing your ${"skillId" in pendingEvidence ? "credential" : "project"}.`,
                  body: "Your verified skills update once a BASIX admin confirms it.",
                  cta: "Add a project",
                  to: "/profile/projects/new",
                }
              : {
                  title: "No open request needs your verified skills yet.",
                  body: "Add evidence for more skills, or check the open requests.",
                  cta: "See open requests",
                  to: "/requests",
                };

  const shownRequests = (eligible.length > 0 ? eligible : open).slice(0, 3);
  const selfDescribed = profile ? [...profile.skillSet, ...profile.suggestedSkills] : [];
  const showcased = projects.filter((p) => p.showcased || p.showcaseStatus !== "none");

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <h1 className="sr-only">Home</h1>

      <section
        aria-label="Next step"
        className="flex flex-col gap-8 rounded-3xl border border-border bg-surface-strong p-6 sm:p-9 xl:flex-row xl:items-center"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center xl:flex-1">
          <ProgressRing done={done} total={steps.length} />
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-amber-ink">Next step</span>
            <p className="font-display text-[26px] leading-tight tracking-[-0.01em] text-ink sm:text-[32px]">{next.title}</p>
            <p className="max-w-lg text-[15px] leading-relaxed text-ink-2">{next.body}</p>
            <Link
              to={next.to}
              className="inline-flex h-12 w-fit items-center gap-2 rounded-xl bg-accent-green px-5 text-[15px] font-semibold text-white shadow-card transition-colors hover:bg-accent-green-hover"
            >
              {next.cta.startsWith("Add") ? <Plus aria-hidden="true" className="h-4 w-4" /> : null}
              {next.cta}
              {next.cta.startsWith("Add") ? null : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
            </Link>
          </div>
        </div>
        <ol aria-label="Your progress" className="flex flex-col xl:w-[360px]">
          {steps.map((step, index) => (
            <li key={step.label} className="flex gap-3.5">
              <span className="flex flex-col items-center">
                <StepIcon state={step.state} />
                {index < steps.length - 1 ? (
                  <span aria-hidden="true" className={`w-[2px] flex-1 ${step.state === "done" ? "bg-accent-green" : "bg-border"}`} />
                ) : null}
              </span>
              <span className="flex flex-wrap items-center gap-2 pb-6 pt-1">
                <span className={`text-[16px] ${step.state === "done" || step.state === "review" ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {step.label}
                </span>
                {step.pill ? (
                  <span
                    className={`rounded-pill px-2.5 py-0.5 text-[12.5px] font-medium ${step.state === "rejected" ? "bg-danger-tint text-danger" : "bg-amber-fill text-amber-ink"}`}
                  >
                    {step.pill}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="requests-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="requests-heading" className="text-[19px] font-semibold text-ink sm:text-[21px]">
            {eligible.length > 0 ? "Requests you're eligible for" : "Open requests"}
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-[14px]">
            {!confirmed ? (
              <span className="inline-flex items-center gap-1.5 text-amber-ink">
                <Lock aria-hidden="true" className="h-4 w-4" />
                Bidding opens once you’re confirmed
              </span>
            ) : null}
            <Link to="/requests" className="-my-2 inline-flex items-center gap-1 py-2.5 font-semibold text-accent-green hover:underline">
              See all open requests
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {requestsLoading ? (
          <p aria-live="polite" className="rounded-xl border border-dashed border-border-strong px-5 py-5 text-[14px] text-ink-3">
            Loading open requests…
          </p>
        ) : requestsError ? (
          <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
            {requestsError}
          </p>
        ) : shownRequests.length === 0 ? (
          <EmptyBox title="No open requests" body="Founders publish requests from their routes; they appear here with the engine's verdict for you." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shownRequests.map((request) => {
              const verdict = request.eligibility;
              const isEligible = verdict?.eligible === true;
              const reasonId = `home-reason-${request.id}`;
              return (
                <li key={request.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {isEligible && verdict ? (
                      <span className="rounded-pill bg-credential-tint px-2.5 py-1 text-[13px] font-semibold text-accent-green">
                        Eligible: {verdict.skills.map((s) => SKILL_LABELS[s]).join(", ")}
                      </span>
                    ) : (
                      <span className="rounded-pill bg-surface px-2.5 py-1 text-[13px] font-medium text-ink-3">Not eligible yet</span>
                    )}
                    {request.demoData ? <DemoDataPill /> : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-semibold leading-snug text-ink">{request.title}</h3>
                    <span className="font-mono text-[14px] text-ink-2">{usd(request.dailyBudget)} · team budget</span>
                    <span className="text-[14px] text-ink-3">
                      {MODE_LABEL[request.deliveryMode]} · {request.brief.maximumTeamSize}{" "}
                      {request.brief.maximumTeamSize === 1 ? "builder" : "builders"}
                    </span>
                    {!isEligible && verdict?.reason ? (
                      <span id={reasonId} className="text-[13px] leading-snug text-ink-3">
                        {verdict.reason}
                      </span>
                    ) : null}
                  </div>
                  {isEligible ? (
                    <Link
                      to="/requests"
                      className="mt-auto inline-flex h-11 items-center justify-center rounded-xl bg-accent-green text-[15px] font-semibold text-white transition-colors hover:bg-accent-green-hover"
                    >
                      Place a bid
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-describedby={verdict?.reason ? reasonId : undefined}
                      className="mt-auto h-11 rounded-xl bg-surface text-[15px] font-medium text-ink-3"
                    >
                      Place a bid · {confirmed ? "not eligible" : "after review"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <section id="bids" aria-labelledby="my-bids-heading" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-6">
          <div className="flex flex-col gap-1">
            <h2 id="my-bids-heading" className="text-[19px] font-semibold text-ink">
              My bids
            </h2>
            <p className="text-[13.5px] text-ink-3">Requests you've applied to work on, and their status.</p>
          </div>
          {bids.length === 0 ? (
            <EmptyBox title="No bids yet" body="Bids you place on open requests show here." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {bids.map((bid) => (
                <li key={bid.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-ink">{bid.requestTitle}</span>
                    {bid.demoData ? <DemoDataPill /> : null}
                  </span>
                  <span className="text-[13.5px] text-ink-3">
                    {usd(bid.dayRate)} · Sent · {bid.requestStatus === "open" ? "request open" : "request closed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          id="interviews"
          aria-labelledby="my-interviews-heading"
          className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-6"
        >
          <h2 id="my-interviews-heading" className="text-[19px] font-semibold text-ink">
            Upcoming interviews
          </h2>
          {bookings.length === 0 ? (
            <EmptyBox title="Nothing booked" body="When a founder proposes a time, you can accept or counter it here." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {bookings.map((booking) => (
                <li key={booking.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <Link to={`/bookings/${encodeURIComponent(booking.id)}`} className="text-[15px] font-semibold text-ink hover:text-accent-green hover:underline">
                    {booking.requestTitle ?? "Interview"}
                  </Link>
                  <span className="text-[13.5px] text-ink-3">
                    {formatNairobi(booking.proposedStartLocal)} · {booking.durationMin} min
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`rounded-pill px-2.5 py-0.5 text-[12.5px] font-medium ${STATE_PILL[booking.state]}`}>
                      {STATE_LABEL[booking.state]}
                    </span>
                    {booking.demoData ? <DemoDataPill /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="evidence-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-strong p-6 lg:col-span-2 xl:col-span-1">
          <h2 id="evidence-heading" className="text-[19px] font-semibold text-ink">
            Your evidence
          </h2>
          {evidence.length === 0 ? (
            <EmptyBox title="No evidence yet" body="Credentials and completed projects you add show here with their review status." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {credentials.map((credential) => (
                <li key={credential.id} className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-pill px-3 py-1 text-[13.5px] font-semibold ${credential.status === "confirmed" ? "bg-credential-tint text-accent-green" : credential.status === "pending" ? "bg-amber-fill text-amber-ink" : "bg-danger-tint text-danger"}`}
                  >
                    {credential.skillId ? `${SKILL_LABELS[credential.skillId]} · ` : ""}Credential
                  </span>
                  <span className="text-[13.5px] text-ink-2">{credential.title}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {credential.status === "pending" ? "Pending review" : credential.status === "confirmed" ? "Confirmed" : "Rejected"}
                  </span>
                </li>
              ))}
              {projects.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-pill px-3 py-1 text-[13.5px] font-semibold ${project.status === "confirmed" ? "bg-project-tint text-project" : project.status === "pending" ? "bg-amber-fill text-amber-ink" : "bg-danger-tint text-danger"}`}
                  >
                    {project.skillIds.map((s) => SKILL_LABELS[s]).join(", ")} · Project
                  </span>
                  <span className="text-[13.5px] text-ink-2">{project.title}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {project.status === "pending" ? "Pending review" : project.status === "confirmed" ? "Confirmed" : "Rejected"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {selfDescribed.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-[13.5px] text-ink-3">Self-described · not used for routing</span>
              <ul className="flex flex-wrap gap-2">
                {selfDescribed.map((skill) => (
                  <li key={skill} className="rounded-pill border border-dashed border-border-strong px-3 py-1 text-[13.5px] text-ink-2">
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showcased.length > 0 ? (
            <ul className="flex flex-col gap-2 border-t border-border pt-4">
              {showcased.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">Showcase: {project.title}</span>
                  <ShowcaseStatusPill status={project.showcaseStatus} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}

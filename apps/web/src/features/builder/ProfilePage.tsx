/**
 * /profile (screen 8, Stitch batch-3/builder-profile, D-36). Loads the builder's profile,
 * credentials and projects; a 404 on the profile means "create mode" with an empty form. The
 * "Pending BASIX confirmation" banner shows whenever the account is not confirmed: the builder
 * is absent from routes, bids and candidate lists until an admin confirms (DOMAIN.md §Marketplace).
 */
import type { BuilderProfile, Credential, Project } from "@venture-route/contracts";
import { useEffect, useState } from "react";

import { ApiNotFoundError } from "../../api/client";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { DemoDataPill } from "../../components/DemoDataPill";
import { CredentialsCard } from "./CredentialsCard";
import { ProfileForm } from "./ProfileForm";
import { ProjectsCard } from "./ProjectsCard";
import { errorMessage } from "./formStyles";

type Loaded = { profile: BuilderProfile | null; credentials: Credential[]; projects: Project[] };

/** "no profile yet" is a normal state, not an error; any other failure surfaces. */
function orNotFound<T>(fallback: T): (cause: unknown) => T {
  return (cause) => {
    if (cause instanceof ApiNotFoundError) return fallback;
    throw cause;
  };
}

export function ProfilePage() {
  const api = useMarketplaceApi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getProfile().catch(orNotFound<BuilderProfile | null>(null)),
      api.listCredentials().catch(orNotFound<Credential[]>([])),
      api.listProjects().catch(orNotFound<Project[]>([])),
    ])
      .then(([profile, credentials, projects]) => {
        if (!cancelled) setLoaded({ profile, credentials, projects });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(errorMessage(cause, "Your profile could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const profile = loaded?.profile ?? null;
  const pending = profile !== null && profile.accountStatus !== "confirmed";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-ink-3">Registry profile</span>
            <span aria-hidden="true" className="text-border-strong">
              /
            </span>
            <span className="font-medium text-ink">Builder account</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">Your profile</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
            Founders see this. Skills show as verified only when a credential or completed project proves them and an admin
            confirms it.
          </p>
        </div>
        <DemoDataPill />
      </header>

      {pending ? (
        <section
          role="status"
          aria-label="Account status"
          className="flex flex-col gap-1 rounded-card border border-amber-ink/40 bg-amber-fill/40 px-4 py-3"
        >
          <p className="text-sm font-semibold text-amber-ink">Pending BASIX confirmation</p>
          <p className="text-[13px] leading-relaxed text-ink-2">
            You can edit your profile now, but you are absent from routes, bids and candidate lists until a BASIX admin
            confirms your account.
          </p>
        </section>
      ) : null}

      {loadError ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {loadError}
        </p>
      ) : null}

      {loaded === null && loadError === null ? (
        <p aria-live="polite" className="text-sm text-ink-muted">
          Loading your profile…
        </p>
      ) : null}

      {loaded ? (
        <>
          {/* No key on purpose: a save must not remount the form (it keeps the draft and the saved message). */}
          <ProfileForm
            profile={profile}
            onSave={async (input) => {
              const next = await api.putProfile(input);
              setLoaded((current) => (current ? { ...current, profile: next } : { profile: next, credentials: [], projects: [] }));
            }}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CredentialsCard
              credentials={loaded.credentials}
              hasProfile={profile !== null}
              onAdd={async (input) => {
                const created = await api.postCredential(input);
                setLoaded((current) => (current ? { ...current, credentials: [...current.credentials, created] } : current));
              }}
            />
            <ProjectsCard projects={loaded.projects} hasProfile={profile !== null} />
          </div>
        </>
      ) : null}
    </div>
  );
}

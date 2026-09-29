/**
 * /showcase (spec #86 stories 30-38, Stitch 6.1 — Q-17 fallback composed from
 * design/stitch/batch-4/requests-board since there is no batch-6 export): a public gallery of
 * admin-approved builder projects, no sign-in needed. One call to `MarketplaceApi.showcase.list`
 * per filter/search/paging change; every filter lives in the URL query string so a reload or a
 * shared link restores the same view. The engine decides which cards match and how (`matchedSkill`,
 * D-52 display facts) — this screen only renders what it returns (AGENTS.md rule 1).
 */
import type { ShowcasePage as ShowcasePageT, SkillId, Vertical } from "@venture-route/contracts";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { ShowcaseListParams } from "../../api/marketplace";
import { useMarketplaceApi } from "../../api/marketplaceContext";
import { SKILL_LABELS, SKILLS, VERTICAL_LABELS, VERTICALS } from "../../lib/brief";
import { errorMessage } from "../builder/formStyles";
import { ShowcaseCard } from "./ShowcaseCard";

const LIMIT = 12;
const SKELETON_COUNT = 6;

type Filters = {
  q: string;
  skill: SkillId | null;
  vertical: Vertical | null;
  licensable: boolean;
  offset: number;
};

const EMPTY_FILTERS: Filters = { q: "", skill: null, vertical: null, licensable: false, offset: 0 };

function filtersFromParams(params: URLSearchParams): Filters {
  const skillParam = params.get("skill");
  const skill = (SKILLS as readonly string[]).includes(skillParam ?? "") ? (skillParam as SkillId) : null;
  const verticalParam = params.get("vertical");
  const vertical = (VERTICALS as readonly string[]).includes(verticalParam ?? "") ? (verticalParam as Vertical) : null;
  const offsetParam = Number(params.get("offset"));
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.floor(offsetParam) : 0;
  return { q: params.get("q") ?? "", skill, vertical, licensable: params.get("licensable") === "true", offset };
}

function paramsFromFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.skill) params.set("skill", filters.skill);
  if (filters.vertical) params.set("vertical", filters.vertical);
  if (filters.licensable) params.set("licensable", "true");
  if (filters.offset > 0) params.set("offset", String(filters.offset));
  return params;
}

/** The engine params (spec #86 §API contracts): `licensable` is omitted, never sent `false`, so
 * the toggle being off never asks for the non-licensable-only slice (ruling carried from #101). */
function listParamsFor(filters: Filters): ShowcaseListParams {
  const params: ShowcaseListParams = { limit: LIMIT, offset: filters.offset };
  if (filters.q) params.q = filters.q;
  if (filters.skill) params.skill = filters.skill;
  if (filters.vertical) params.vertical = filters.vertical;
  if (filters.licensable) params.licensable = true;
  return params;
}

function chipClass(selected: boolean): string {
  return `inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
    selected
      ? "border-accent-green bg-accent-green text-white"
      : "border-border-strong bg-surface-strong text-ink hover:border-accent-green"
  }`;
}

export function ShowcaseGalleryPage() {
  const api = useMarketplaceApi();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  // The lazy initial value only seeds the box from the URL on first render (a chip click keeps
  // `q` unchanged); "Clear filters" resets it explicitly. No effect needed to re-sync it.
  const [searchInput, setSearchInput] = useState(filters.q);
  const [page, setPage] = useState<ShowcasePageT | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `resultKey` names which filters `page`/`error` answer; while it lags `requestKey` the fetch
  // for the current filters is still in flight, so the skeleton shows — derived, never a
  // synchronous setState in the effect body (react-hooks/set-state-in-effect).
  const [resultKey, setResultKey] = useState<string | null>(null);
  const requestKey = JSON.stringify(filters);
  const loading = resultKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    api.showcase
      .list(listParamsFor(filters))
      .then((result) => {
        if (cancelled) return;
        setPage(result);
        setError(null);
        setResultKey(requestKey);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(errorMessage(cause, "The showcase could not be loaded."));
        setPage(null);
        setResultKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, requestKey]);

  function setFilter(patch: Partial<Pick<Filters, "q" | "skill" | "vertical" | "licensable">>) {
    setParams(paramsFromFilters({ ...filters, ...patch, offset: 0 }), { replace: true });
  }

  function setOffset(offset: number) {
    setParams(paramsFromFilters({ ...filters, offset }), { replace: true });
  }

  function clearFilters() {
    setSearchInput(EMPTY_FILTERS.q);
    setParams(paramsFromFilters(EMPTY_FILTERS), { replace: true });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter({ q: searchInput.trim() });
  }

  const total = page?.total ?? 0;
  const shownCount = page?.items.length ?? 0;
  const from = shownCount > 0 ? filters.offset + 1 : 0;
  const to = filters.offset + shownCount;
  const hasFilters = Boolean(filters.q || filters.skill || filters.vertical || filters.licensable);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl leading-tight text-ink">Showcase</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
          Projects that builders in the BASIX cohorts have shipped. Each entry is reviewed by a BASIX admin before it
          appears here.
        </p>
      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-4">
          <form role="search" onSubmit={submitSearch} className="flex items-center gap-2">
            <input
              type="search"
              aria-label="Search by title"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by title"
              className="h-9 w-[280px] rounded-card border border-border-strong bg-surface-strong px-3 text-sm"
            />
            <button
              type="submit"
              className="h-9 rounded-card border border-border-strong bg-surface-strong px-3 text-sm text-ink"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Skill">
            {SKILLS.map((skillId) => (
              <button
                key={skillId}
                type="button"
                aria-pressed={filters.skill === skillId}
                className={chipClass(filters.skill === skillId)}
                onClick={() => setFilter({ skill: filters.skill === skillId ? null : skillId })}
              >
                {SKILL_LABELS[skillId]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vertical">
            {VERTICALS.map((vertical) => (
              <button
                key={vertical}
                type="button"
                aria-pressed={filters.vertical === vertical}
                className={chipClass(filters.vertical === vertical)}
                onClick={() => setFilter({ vertical: filters.vertical === vertical ? null : vertical })}
              >
                {VERTICAL_LABELS[vertical]}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={filters.licensable}
                onChange={(event) => setFilter({ licensable: event.target.checked })}
              />
              Licensable IP
            </label>
          </div>
        </div>

        <p className="whitespace-nowrap text-[13px] text-ink-3">Most recently confirmed first</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-card border border-danger/40 bg-surface-strong px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div
              key={index}
              data-testid="showcase-skeleton"
              aria-hidden="true"
              className="h-64 animate-pulse rounded-card border border-border bg-surface-strong"
            />
          ))}
        </div>
      ) : null}

      {!loading && !error && page ? (
        page.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-4 py-12 text-center">
            <p className="text-sm text-ink-muted">No showcase entries match these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters && filters.offset === 0}
              className="rounded-card border border-border-strong bg-surface-strong px-3 py-1.5 text-sm text-ink"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {page.items.map((card) => (
                <ShowcaseCard key={card.id} card={card} />
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-[13px] text-ink-3">
                Showing {from}–{to} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={filters.offset === 0}
                  onClick={() => setOffset(Math.max(0, filters.offset - LIMIT))}
                  className="rounded-card border border-border-strong bg-surface-strong px-3 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={to >= total}
                  onClick={() => setOffset(filters.offset + LIMIT)}
                  className="rounded-card border border-accent-green bg-accent-green px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

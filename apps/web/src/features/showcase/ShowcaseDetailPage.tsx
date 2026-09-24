/**
 * /showcase/:projectId (spec #86 stories 39-46): a public project page, no sign-in needed.
 * Placeholder for #105, which replaces this body with the pitch, links and builder panel wired
 * to `MarketplaceApi.showcase.get`.
 */
import { useParams } from "react-router";

export function ShowcaseDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-16">
      <h1 className="font-display text-4xl leading-tight text-ink">Showcase project {projectId}</h1>
    </div>
  );
}

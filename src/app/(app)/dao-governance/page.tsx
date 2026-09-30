import { redirect } from "next/navigation";

interface DaoGovernanceAliasPageProps {
  searchParams: Promise<{ onboarding?: string | string[] }>;
}

/**
 * Alias used by the dashboard onboarding CTA.
 * The live governance console lives at `/governance`.
 * Forwards `onboarding=vote` so the guided vote banner can render.
 */
export default async function DaoGovernanceAliasPage({
  searchParams,
}: DaoGovernanceAliasPageProps) {
  const params = await searchParams;
  const onboarding = Array.isArray(params.onboarding)
    ? params.onboarding[0]
    : params.onboarding;

  if (onboarding === "vote") {
    redirect("/governance?onboarding=vote");
  }

  redirect("/governance");
}

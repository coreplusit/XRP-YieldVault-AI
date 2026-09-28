import { Features } from "@/components/home/Features";
import { Hero } from "@/components/home/Hero";
import { StatsBar } from "@/components/home/StatsBar";

/**
 * Landing page composition root — aggregates all home-specific sections.
 */
export function LandingPage() {
  return (
    <>
      <Hero />
      <div className="pb-8 pt-4">
        <StatsBar />
      </div>
      <Features />
    </>
  );
}

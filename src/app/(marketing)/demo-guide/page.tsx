import { redirect } from "next/navigation";

/**
 * Older Demo Guide URL. The walkthrough now lives at /guide.
 */
export default function DemoGuideRedirectPage(): never {
  redirect("/guide");
}

import { redirect } from "next/navigation";

/**
 * Older Documentation URL. The walkthrough now lives at /guide.
 */
export default function DocsRedirectPage(): never {
  redirect("/guide");
}

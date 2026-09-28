import { AppLayout } from "@/components/layout/AppLayout";

interface AuthenticatedAppLayoutProps {
  children: React.ReactNode;
}

/**
 * Route-group layout for authenticated console pages.
 * Shared shell enables client-side tab switching without remounting providers.
 */
export default function AuthenticatedAppLayout({
  children,
}: AuthenticatedAppLayoutProps) {
  return <AppLayout>{children}</AppLayout>;
}

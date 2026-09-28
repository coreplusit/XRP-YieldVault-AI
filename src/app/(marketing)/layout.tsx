import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

/**
 * Public marketing shell — landing header + footer.
 */
export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <>
      <Header />
      <main className="relative flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

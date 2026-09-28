import { GoogleLoginBtn } from "@/components/auth/GoogleLoginBtn";
import { LandingPage } from "@/components/home/LandingPage";

export default function HomePage() {
  return (
    <>
      <LandingPage />
      <section
        id="auth-test"
        className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
        aria-label="Web3Auth Google login test"
      >
        <div className="glass-panel rounded-2xl p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vault-cyan">
            Auth Integration Test
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Sign in with Google (Web3Auth)
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-vault-muted">
            Non-custodial Gmail login on Sapphire Devnet. On success, a
            deterministic XRPL address is derived and synced to Supabase.
          </p>
          <div className="mt-6">
            <GoogleLoginBtn />
          </div>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";

export const metadata = { title: "Terms of Service — Flappy Beerd" };

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "var(--bg-deep)", color: "var(--text-primary)" }}>
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs" style={{ color: "var(--cyan)" }}>← Back</Link>
        <h1 className="text-3xl font-black mt-3 mb-2 gradient-text" style={{ fontFamily: "var(--font-display)" }}>
          Terms of Service
        </h1>
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Last updated: 2026-04-08</p>

        <Section title="1. Acceptance">
          <p>By connecting your wallet and interacting with Flappy Beerd, you agree to these terms. If you do not agree, do not use the service.</p>
        </Section>

        <Section title="2. Nature of the service">
          <p>Flappy Beerd is an entertainment application that interacts with a public smart contract on the Base network. Gameplay outcomes and reward distribution are governed by the contract code, which is publicly verifiable.</p>
        </Section>

        <Section title="3. Eligibility">
          <p>You must be of legal age to enter into a binding contract in your jurisdiction and must not be a resident of any jurisdiction where access to play-to-earn applications is prohibited. You are solely responsible for compliance with local law.</p>
        </Section>

        <Section title="4. No financial advice, no investment">
          <p>Rewards distributed by the contract are denominated in ETH. Cryptocurrency values fluctuate. Nothing on this site is financial advice. Do not spend more than you are willing to lose.</p>
        </Section>

        <Section title="5. Anti-cheat & fairness">
          <p>To prevent score manipulation, score submissions must be signed by our trusted signer service. Attempts to submit unauthenticated, replayed, or out-of-bounds scores will be rejected by the contract. Repeated abuse may result in your wallet being denylisted at the application layer.</p>
        </Section>

        <Section title="6. No warranty">
          <p>The service is provided <b>AS IS</b> without warranties of any kind. Smart contracts may contain bugs. Network outages, RPC failures, and wallet errors may occur.</p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>To the maximum extent permitted by law, the operators of Flappy Beerd shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the service, including loss of funds, missed rewards, or transaction failures.</p>
        </Section>

        <Section title="8. Changes">
          <p>Smart contract parameters (play cost, reward, min score, treasury split, pause state) may be updated by the contract owner. Changes are publicly visible onchain.</p>
        </Section>

        <Section title="9. Governing terms">
          <p>The smart contract is the source of truth for any dispute over balances, rewards, or game state. The frontend is a convenience interface only.</p>
        </Section>

        <p className="text-[11px] mt-8" style={{ color: "var(--text-muted)" }}>
          See also: <Link href="/privacy" style={{ color: "var(--cyan)" }}>Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: "var(--cyan)", fontFamily: "var(--font-display)" }}>{title}</h2>
      <div className="text-sm space-y-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{children}</div>
    </section>
  );
}

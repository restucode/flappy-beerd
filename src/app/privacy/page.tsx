import Link from "next/link";

export const metadata = { title: "Privacy Policy — Flappy Beerd" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "var(--bg-deep)", color: "var(--text-primary)" }}>
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs" style={{ color: "var(--cyan)" }}>← Back</Link>
        <h1 className="text-3xl font-black mt-3 mb-2 gradient-text" style={{ fontFamily: "var(--font-display)" }}>
          Privacy Policy
        </h1>
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Last updated: 2026-04-08</p>

        <Section title="What we collect">
          <p>Flappy Beerd is a fully onchain game. We do not operate a user database. The following data is processed:</p>
          <ul>
            <li><b>Wallet address.</b> Required to interact with the smart contract. Public by nature of the blockchain.</li>
            <li><b>Game scores.</b> Submitted onchain by you. Public by nature of the blockchain.</li>
            <li><b>Anti-cheat signing requests.</b> Our backend receives <code>(player address, gameId, score)</code> for the sole purpose of producing a signature. We do not persist these.</li>
            <li><b>localStorage.</b> Sound preference and onboarding completion flag. Stored only on your device.</li>
          </ul>
        </Section>

        <Section title="What we do not collect">
          <ul>
            <li>No email, phone, name, or KYC.</li>
            <li>No analytics cookies.</li>
            <li>No third-party advertising trackers.</li>
            <li>No private keys — your wallet handles signing.</li>
          </ul>
        </Section>

        <Section title="Third parties">
          <p>RPC requests are routed through your wallet provider and/or our configured RPC endpoint. Their privacy practices apply to those requests.</p>
        </Section>

        <Section title="Your rights">
          <p>Onchain data is immutable and cannot be deleted. You may stop using the app at any time. Disconnect your wallet to end any local session.</p>
        </Section>

        <Section title="Contact">
          <p>For privacy questions, open an issue on our GitHub repository.</p>
        </Section>

        <p className="text-[11px] mt-8" style={{ color: "var(--text-muted)" }}>
          See also: <Link href="/terms" style={{ color: "var(--cyan)" }}>Terms of Service</Link>
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

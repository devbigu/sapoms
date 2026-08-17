import type { ReactNode } from "react";

const TERMS_SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or using this platform, you agree to be bound by these Terms and Conditions and all applicable laws and regulations. If you do not agree with any part of these terms, you are prohibited from using or accessing this platform.",
  },
  {
    title: "2. Use License",
    body: "Permission is granted to temporarily access the platform for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not modify or copy the materials, use the materials for any commercial purpose or for any public display, or remove any copyright or other proprietary notations from the materials.",
  },
  {
    title: "3. Data & Privacy",
    body: "We collect information you provide directly to us. We may use your information to operate, maintain, and improve our services; process transactions; send you technical notices, updates, security alerts, and support messages. We do not sell, trade, or transfer your personally identifiable information to third parties without your consent.",
  },
  {
    title: "4. User Responsibilities",
    body: "You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account or any breach of security.",
  },
  {
    title: "5. Prohibited Activities",
    body: "You are prohibited from using the platform to transmit any unsolicited or unauthorized advertising or promotional material, engage in any conduct that restricts or inhibits anyone's use or enjoyment of the platform, or use the platform in any way that violates any applicable local, national, or international law or regulation.",
  },
  {
    title: "6. Disclaimer",
    body: "The materials on this platform are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim all other warranties including without limitation implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property.",
  },
  {
    title: "7. Limitations",
    body: "In no event shall the platform or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on the platform.",
  },
  {
    title: "8. Governing Law",
    body: "These terms and conditions are governed by and construed in accordance with applicable laws and you irrevocably submit to the exclusive jurisdiction of the courts in the applicable location.",
  },
] as const;

export function TermsDocument() {
  return (
    <>
      {TERMS_SECTIONS.map((section) => (
        <TermsSection key={section.title} title={section.title}>
          {section.body}
        </TermsSection>
      ))}
    </>
  );
}

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-1.5 font-semibold text-slate-900">{title}</h2>
      <p>{children}</p>
    </div>
  );
}

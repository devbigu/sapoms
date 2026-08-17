"use client";

import { useEffect, useMemo, useState } from "react";
import TermsModal from "@/components/TermsModal";
import { useAuthSession } from "@/hooks/useAuthSession";

function hasAcceptedTerms(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export default function DealerTermsGate() {
  const auth = useAuthSession();
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  const dealer = useMemo(() => {
    if (auth.loading || auth.session.status !== "authenticated" || auth.session.role !== "dealer") return null;
    return auth.session.user;
  }, [auth]);

  useEffect(() => {
    setAcceptedAt(typeof dealer?.termsAcceptedAt === "string" ? dealer.termsAcceptedAt : null);
  }, [dealer?.Dealer_Id, dealer?.termsAcceptedAt]);

  const shouldShow = Boolean(dealer?.Dealer_Id) && !hasAcceptedTerms(acceptedAt ?? dealer?.termsAcceptedAt);

  if (!shouldShow) return null;

  return (
    <TermsModal
      userId={String(dealer?.Dealer_Id ?? "")}
      userName={String(dealer?.Dealer_Name ?? "Dealer")}
      onAccepted={(nextAcceptedAt) => {
        setAcceptedAt(nextAcceptedAt);

        try {
          const raw = localStorage.getItem("UserData");
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            parsed.termsAcceptedAt = nextAcceptedAt;
            localStorage.setItem("UserData", JSON.stringify(parsed));
            window.dispatchEvent(new Event("omsons-auth-changed"));
          }
        } catch {}
      }}
    />
  );
}

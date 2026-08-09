"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Stage = "cart" | "slot" | "payment" | null;

function stageDepuisChemin(pathname: string): Stage {
  if (pathname === "/panier") return "cart";
  if (pathname === "/commande/creneau") return "slot";
  if (pathname === "/commande/paiement") return "payment";
  return null;
}
async function envoyer(corps: Record<string, unknown>) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
  } catch {
    // La mesure ne doit jamais gêner le parcours client.
  }
}

export function SuiviParcours() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/livreur")) return;
    const params = new URLSearchParams(window.location.search);
    void envoyer({
      path: `${pathname}${window.location.search}`,
      stage: stageDepuisChemin(pathname),
      referrer: document.referrer,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    });
  }, [pathname]);

  return null;
}

export function SuiviCreneauxIndisponibles() {
  useEffect(() => {
    void envoyer({
      path: `${window.location.pathname}${window.location.search}`,
      perte: "no_slot",
      referrer: document.referrer,
    });
  }, []);
  return null;
}

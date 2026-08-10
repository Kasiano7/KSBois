import type { Metadata } from "next";
import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import { getTenant, themeToCss } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { SuiviParcours } from "@/components/analytics/suivi-parcours";
import { PreconnexionImagekit } from "@/components/media";
import "./globals.css";

// ⚠️ shadcn init avait ajouté Geist et redéfini --font-sans. Retiré : la police
// d'interface du projet est Archivo (docs/03 §3). Si une future commande
// `shadcn` le réintroduit, le supprimer de nouveau.

/**
 * Typographie — docs/03-DESIGN-SYSTEM.md §3
 * Fraunces  : display, empattements en biseau (fente du bois)
 * Archivo   : corps et interface, grotesque robuste
 * Plex Mono : références et SKU dans l'admin uniquement
 */
// Police variable : ne PAS passer de liste `weight` en même temps que `axes`,
// Next.js 16 rejette la combinaison. Sans `weight`, toute la plage est servie.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bois de chauffage — livraison en Ardèche",
    template: "%s · Bois de chauffage",
  },
  description:
    "Bois de chauffage sec, coupé et livré en Ardèche nord. Chêne, hêtre et charme en 25, 33, 40 et 50 cm. Commande en ligne, livraison à domicile.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Thème white-label : les tokens de l'entreprise surchargent les défauts de
  // globals.css. Changer d'entreprise = changer 6 valeurs en base (docs/03 §2.3).
  const tenant = await getTenant();
  const themeCss = tenant ? themeToCss(tenant.theme) : "";

  return (
    <html
      lang="fr"
      className={cn(
        "h-full antialiased",
        fraunces.variable,
        archivo.variable,
        plexMono.variable,
      )}
    >
      <head>
        <PreconnexionImagekit />
        {themeCss && <style>{themeCss}</style>}
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <SuiviParcours />
      </body>
    </html>
  );
}

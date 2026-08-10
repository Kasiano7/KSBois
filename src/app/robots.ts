import type { MetadataRoute } from "next";
import { urlAbsolue } from "@/lib/seo";

/**
 * robots.txt — docs/06 §1.6.
 *
 * ⚠️ `Disallow` n'est PAS une protection : il empêche l'exploration, pas
 * l'accès. Ce qui protège l'administration et l'espace client, c'est
 * `requireRole()` et la RLS. Ici, on évite simplement de gaspiller le budget
 * d'exploration sur des pages qui renverront une redirection de connexion.
 *
 * Les pages du tunnel sont exclues pour une autre raison : une page de panier
 * ou de paiement indexée ramène des visiteurs sur une étape sans contexte, ce
 * qui gonfle le taux de rebond sans jamais convertir.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/compte",
          "/connexion",
          "/panier",
          "/commande",
          // Aucune URL à paramètres n'est indexable (docs/06 §1.2).
          "/*?*",
        ],
      },
    ],
    sitemap: urlAbsolue("/sitemap.xml"),
    host: urlAbsolue("/"),
  };
}

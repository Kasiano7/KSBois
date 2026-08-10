"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react";
import {
  enregistrerTexteAlternatif,
  supprimerMedia,
} from "@/server/actions/admin-medias";
import { Media } from "@/components/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MediaAdmin } from "@/server/medias";

/**
 * Grille de la bibliothèque de médias.
 *
 * Le texte alternatif est éditable EN LIGNE, sur la vignette, et son absence
 * est signalée en rouge. C'est volontairement inconfortable : une image sans
 * description est inaccessible aux personnes malvoyantes et invisible pour les
 * moteurs de recherche (docs/04 §3).
 */

function poids(octets: number | null): string {
  if (octets === null) return "";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export function GrilleMedias({
  medias,
  estGerant,
}: {
  medias: MediaAdmin[];
  estGerant: boolean;
}) {
  if (medias.length === 0) {
    return (
      <p className="text-cendre-clair mt-6 text-[17px]">
        Aucune image dans cette sélection. Téléversez-en ci-dessus.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {medias.map((media) => (
        <li key={media.id}>
          <CarteMedia media={media} estGerant={estGerant} />
        </li>
      ))}
    </ul>
  );
}

function CarteMedia({ media, estGerant }: { media: MediaAdmin; estGerant: boolean }) {
  const [alt, setAlt] = useState(media.altText ?? "");
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const modifie = alt.trim() !== (media.altText ?? "").trim();
  const sansDescription = !media.altText?.trim();

  const lancer = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setMessage(null);
    demarrer(async () => {
      const resultat = await fn();
      setMessage({
        ton: resultat.ok ? "ok" : "erreur",
        texte: resultat.message ?? (resultat.ok ? "Enregistré." : "Échec."),
      });
    });
  };

  return (
    <article
      className={`overflow-hidden rounded-[12px] border ${
        sansDescription ? "border-alerte/50" : "border-ecorce-bord"
      }`}
    >
      <Media
        media={media}
        preset="productCard"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        classNameCadre="bg-ecorce"
      />

      <div className="p-4">
        <p className="truncate font-mono text-[12px]" title={media.fileName}>
          {media.fileName}
        </p>
        <p className="text-cendre-clair mt-1 text-[12px]">
          {media.width && media.height ? `${media.width} × ${media.height} · ` : ""}
          {poids(media.sizeBytes)}
          {media.utilisations > 0
            ? ` · utilisé par ${media.utilisations} produit${media.utilisations > 1 ? "s" : ""}`
            : ""}
        </p>

        <label className="mt-3 block">
          <span className="text-cendre-clair block text-[13px] font-semibold">
            Description de l&apos;image
          </span>
          <Input
            value={alt}
            onChange={(evenement) => setAlt(evenement.target.value)}
            placeholder="Tas de bûches de chêne fendues"
            className="mt-1.5 h-11 text-[15px]"
          />
        </label>

        {sansDescription && !modifie && (
          <p className="text-alerte mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed">
            <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
            Sans description, cette image est inutilisable sur le site public.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!modifie || enCours}
            onClick={() => lancer(() => enregistrerTexteAlternatif({ mediaId: media.id, altText: alt }))}
          >
            {enCours ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={15} strokeWidth={2} aria-hidden="true" />
            )}
            Enregistrer
          </Button>

          {estGerant && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Supprimer ${media.fileName}`}
              disabled={enCours}
              onClick={() => {
                if (
                  !window.confirm(
                    `Retirer ${media.fileName} de la bibliothèque ?\n\n` +
                      `Le fichier reste chez ImageKit, mais il ne sera plus proposé dans l'administration.`,
                  )
                ) {
                  return;
                }
                lancer(() => supprimerMedia({ mediaId: media.id }));
              }}
            >
              <Trash2 size={16} strokeWidth={1.9} />
            </Button>
          )}
        </div>

        {message && (
          <p
            role="status"
            className={`mt-2 text-[13px] ${message.ton === "ok" ? "text-succes" : "text-alerte"}`}
          >
            {message.texte}
          </p>
        )}
      </div>
    </article>
  );
}

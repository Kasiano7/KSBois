"use client";

import { useRef, useState, useTransition } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { enregistrerMediaTeleverse } from "@/server/actions/admin-medias";
import { LIBELLES_DOSSIER, type DossierMedia } from "@/lib/medias";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Téléversement direct navigateur → ImageKit — docs/04 §4.
 *
 * Le fichier ne passe PAS par Vercel : on demande d'abord des paramètres signés
 * à `/api/imagekit/auth`, puis on envoie le fichier chez ImageKit, et on
 * n'enregistre en base que ce qu'ImageKit a répondu. Pas de limite de charge
 * utile, pas de bande passante facturée deux fois.
 *
 * ⚠️ `pre: "w-2560,q-82"` recadre AVANT stockage. L'exploitant téléverse des
 * photos de smartphone de 8 à 15 Mo ; on n'en garde qu'une version 2560 px à
 * environ 400 Ko. Sur trois cents photos, c'est la différence entre rester dans
 * le quota gratuit et payer.
 */

const DOSSIERS = Object.keys(LIBELLES_DOSSIER) as DossierMedia[];
const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

interface Progression {
  nom: string;
  etat: "en_cours" | "ok" | "erreur";
  message?: string;
}

export function TeleverseurMedias({ configure }: { configure: boolean }) {
  const [dossier, setDossier] = useState<DossierMedia>("produits");
  const [progressions, setProgressions] = useState<Progression[]>([]);
  const [glisse, setGlisse] = useState(false);
  const [enCours, demarrer] = useTransition();
  const champ = useRef<HTMLInputElement>(null);

  if (!configure) {
    return (
      <div className="border-alerte/40 bg-alerte/10 rounded-[12px] border p-5">
        <p className="font-semibold">La bibliothèque d&apos;images n&apos;est pas configurée</p>
        <p className="text-cendre-clair mt-2 max-w-[70ch] text-[15px] leading-relaxed">
          Le compte ImageKit n&apos;est pas encore ouvert. Renseignez{" "}
          <code className="font-mono text-[13px]">NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT</code>,{" "}
          <code className="font-mono text-[13px]">NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY</code> et{" "}
          <code className="font-mono text-[13px]">IMAGEKIT_PRIVATE_KEY</code> dans les variables
          d&apos;environnement. Le reste du site fonctionne normalement en attendant : les
          emplacements d&apos;images affichent un cadre neutre.
        </p>
      </div>
    );
  }

  async function televerser(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;

    for (const fichier of Array.from(fichiers)) {
      if (fichier.size > TAILLE_MAX_OCTETS) {
        majProgression(fichier.name, "erreur", "Fichier trop lourd (25 Mo maximum).");
        continue;
      }

      majProgression(fichier.name, "en_cours");

      try {
        const reponseAuth = await fetch("/api/imagekit/auth");
        if (!reponseAuth.ok) {
          const corps = await reponseAuth.json().catch(() => ({}));
          majProgression(fichier.name, "erreur", corps.erreur ?? "Autorisation refusée.");
          continue;
        }
        const { token, expire, signature, publicKey } = await reponseAuth.json();

        const formulaire = new FormData();
        formulaire.append("file", fichier);
        formulaire.append("fileName", fichier.name);
        formulaire.append("publicKey", publicKey);
        formulaire.append("token", token);
        formulaire.append("expire", String(expire));
        formulaire.append("signature", signature);
        formulaire.append("folder", `/${dossier}`);
        formulaire.append("useUniqueFileName", "true");
        formulaire.append("tags", dossier);
        // Recadrage avant stockage : on ne conserve jamais l'original brut.
        formulaire.append("transformation", JSON.stringify({ pre: "w-2560,q-82" }));

        const envoi = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
          method: "POST",
          body: formulaire,
        });
        const resultat = await envoi.json();

        if (!envoi.ok) {
          majProgression(fichier.name, "erreur", resultat?.message ?? "Envoi refusé par ImageKit.");
          continue;
        }

        demarrer(async () => {
          const enregistrement = await enregistrerMediaTeleverse({
            imagekitFileId: resultat.fileId,
            filePath: resultat.filePath,
            fileName: resultat.name ?? fichier.name,
            mediaType: (resultat.fileType ?? "image") === "non-image" ? "video" : "image",
            mime: fichier.type || null,
            sizeBytes: resultat.size ?? fichier.size,
            width: resultat.width ?? null,
            height: resultat.height ?? null,
            folder: dossier,
          });
          majProgression(
            fichier.name,
            enregistrement.ok ? "ok" : "erreur",
            enregistrement.ok ? undefined : enregistrement.message,
          );
        });
      } catch (erreur) {
        console.error("[medias] téléversement :", erreur);
        majProgression(fichier.name, "erreur", "Envoi impossible. Vérifiez la connexion.");
      }
    }

    if (champ.current) champ.current.value = "";
  }

  function majProgression(nom: string, etat: Progression["etat"], message?: string) {
    setProgressions((precedentes) => {
      const autres = precedentes.filter((p) => p.nom !== nom);
      return [...autres, { nom, etat, message }];
    });
  }

  return (
    <div>
      <div className="max-w-xs">
        <Label htmlFor="dossier-media">Ranger dans</Label>
        <select
          id="dossier-media"
          value={dossier}
          onChange={(evenement) => setDossier(evenement.target.value as DossierMedia)}
          className="border-input bg-card mt-2 h-12 w-full rounded-[6px] border px-3 text-[17px]"
        >
          {DOSSIERS.map((valeur) => (
            <option key={valeur} value={valeur}>
              {LIBELLES_DOSSIER[valeur]}
            </option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(evenement) => {
          evenement.preventDefault();
          setGlisse(true);
        }}
        onDragLeave={() => setGlisse(false)}
        onDrop={(evenement) => {
          evenement.preventDefault();
          setGlisse(false);
          void televerser(evenement.dataTransfer.files);
        }}
        className={`mt-4 rounded-[12px] border-2 border-dashed p-8 text-center transition-colors ${
          glisse ? "border-seve bg-seve/10" : "border-ecorce-bord"
        }`}
      >
        <CloudUpload
          size={32}
          strokeWidth={1.5}
          className="text-cendre-clair mx-auto"
          aria-hidden="true"
        />
        <p className="mt-3 text-[17px] font-semibold">
          Glissez vos photos ici, ou choisissez-les
        </p>
        <p className="text-cendre-clair mt-1 text-[14px]">
          JPEG, PNG ou WebP · 25 Mo maximum par fichier · plusieurs à la fois
        </p>

        <input
          ref={champ}
          id="fichiers-medias"
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          onChange={(evenement) => void televerser(evenement.target.files)}
        />
        <Button type="button" className="mt-5" onClick={() => champ.current?.click()}>
          {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Choisir des photos
        </Button>
      </div>

      {progressions.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {progressions.map((progression) => (
            <li
              key={progression.nom}
              className="border-ecorce-bord flex flex-wrap items-center justify-between gap-3 rounded-[8px] border px-4 py-2.5 text-[14px]"
            >
              <span className="min-w-0 truncate">{progression.nom}</span>
              <span
                className={
                  progression.etat === "ok"
                    ? "text-succes font-semibold"
                    : progression.etat === "erreur"
                      ? "text-alerte font-semibold"
                      : "text-cendre-clair"
                }
              >
                {progression.etat === "en_cours" && "Envoi en cours…"}
                {progression.etat === "ok" && "Ajouté"}
                {progression.etat === "erreur" && (progression.message ?? "Échec")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

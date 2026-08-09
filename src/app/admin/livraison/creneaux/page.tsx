import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import {
  listerReferentiels,
  listerModeles,
  listerCalendrier,
  listerFermetures,
  grouperParSemaine,
  etatGeneration,
} from "@/server/admin-creneaux";
import { aujourdHui } from "@/server/creneaux";
import { CarteModele } from "@/components/admin/carte-modele-creneau";
import { CalendrierCreneaux } from "@/components/admin/calendrier-creneaux";
import { CreneauExceptionnel } from "@/components/admin/creneau-exceptionnel";
import { FermeturesCreneaux } from "@/components/admin/fermetures-creneaux";
import { GenerationCreneaux } from "@/components/admin/generation-creneaux";

export const metadata: Metadata = {
  title: "Créneaux",
  robots: { index: false, follow: false },
};

/**
 * Créneaux de livraison — docs/05-ADMIN.md §6.2
 *
 * Trois niveaux, du général au particulier, dans cet ordre parce que c'est
 * l'ordre dans lequel l'exploitant raisonne :
 *   1. mes journées de livraison habituelles,
 *   2. les huit prochaines semaines, avec ce qui est déjà pris,
 *   3. mes fermetures.
 */
export default async function PageCreneaux() {
  const session = await requireRole(["owner", "staff"], "/admin/livraison/creneaux");

  const referentiels = await listerReferentiels(session.companyId);
  const [modeles, journees, fermetures, etat] = await Promise.all([
    listerModeles(session.companyId, referentiels),
    listerCalendrier(session.companyId, referentiels),
    listerFermetures(session.companyId, referentiels),
    etatGeneration(session.companyId),
  ]);

  const semaines = grouperParSemaine(journees);
  const actifs = modeles.filter((m) => m.active);
  const aujourdhui = aujourdHui();

  return (
    <main className="p-5 sm:p-8">
      <h1 className="text-[28px] sm:text-[36px]">Créneaux de livraison</h1>
      <p className="text-cendre-clair mt-2 max-w-[68ch] text-[17px] leading-relaxed">
        Vous fixez vos journées de livraison habituelles ; le site en tire les dates proposées aux
        clients. Chaque créneau porte deux limites : un nombre de livraisons et un volume. La
        première atteinte ferme le créneau — c&apos;est presque toujours le volume.
      </p>

      <div className="mt-7">
        <GenerationCreneaux etat={etat} />
      </div>

      {/* Une entreprise sans journée active ne peut recevoir aucune commande
          livrée : c'est la panne la plus grave de cet écran, elle est dite en
          premier et en toutes lettres. */}
      {actifs.length === 0 && (
        <div className="border-alerte/30 bg-alerte/8 mt-6 rounded-[6px] border p-4">
          <p className="font-semibold">Aucune journée de livraison active</p>
          <p className="mt-1.5 text-[15px]">
            Tant qu&apos;aucune journée n&apos;est réglée, le tunnel de commande ne propose aucune
            date et vos clients ne peuvent pas finaliser leur achat.
          </p>
        </div>
      )}

      <section className="mt-9">
        <h2 className="text-[22px]">Vos journées de livraison</h2>
        <p className="text-cendre-clair mt-1.5 max-w-[68ch] text-[15px]">
          Ces réglages se répètent chaque semaine. Les modifier ne change pas les dates déjà
          générées : ajustez-les une par une dans le calendrier ci-dessous.
        </p>

        {modeles.length > 0 && (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {modeles.map((modele) => (
              <CarteModele key={modele.id} modele={modele} referentiels={referentiels} />
            ))}
          </ul>
        )}

        <div className="mt-4">
          <CarteModele modele={null} referentiels={referentiels} />
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-[22px]">Les huit prochaines semaines</h2>
        <p className="text-cendre-clair mt-1.5 max-w-[68ch] text-[15px]">
          Remplissage réel de chaque créneau. Un créneau complet disparaît des propositions faites
          aux clients.
        </p>

        <div className="mt-4">
          <CreneauExceptionnel referentiels={referentiels} premiereDate={aujourdhui} />
        </div>

        <CalendrierCreneaux semaines={semaines} minVolumeM3={etat.minVolumeM3} />
      </section>

      <section className="mt-9">
        <h2 className="text-[22px]">Fermetures</h2>
        <p className="text-cendre-clair mt-1.5 max-w-[68ch] text-[15px]">
          Congés, jours fériés, intempéries. Une période bloquée ferme les créneaux existants et
          empêche d&apos;en générer de nouveaux sur ces dates.
        </p>

        <FermeturesCreneaux
          fermetures={fermetures}
          referentiels={referentiels}
          premiereDate={aujourdhui}
        />
      </section>
    </main>
  );
}

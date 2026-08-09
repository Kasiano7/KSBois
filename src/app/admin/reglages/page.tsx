import type { Metadata } from "next";
import { Building2, Palette, ShoppingCart, CreditCard, Bell, SlidersHorizontal } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrderSettings, getPaymentSettings, getRangementSettings, getRawSettings } from "@/server/reglages";
import {
  enregistrerApparence,
  enregistrerCommandes,
  enregistrerEntreprise,
  enregistrerFonctionnalites,
  enregistrerNotificationsLegal,
  enregistrerPaiementFacturation,
} from "@/server/actions/admin-reglages";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false, follow: false },
};

const TOKENS_PAR_DEFAUT = {
  ecorce: "#171310",
  aubier: "#F4F2EC",
  sapin: "#22392C",
  braise: "#C4501B",
  "braise-texte": "#A83F12",
  seve: "#D9A441",
};

const METHODES = [
  ["card", "Carte bancaire"],
  ["cash", "Espèces"],
  ["check", "Chèque"],
  ["transfer", "Virement"],
  ["sumup", "SumUp"],
] as const;

const FONCTIONNALITES = [
  ["pellets", "Granulés"],
  ["kindling", "Bois d’allumage"],
  ["pallets", "Palettes"],
  ["nets", "Filets"],
  ["pickup", "Retrait au dépôt"],
  ["services", "Services complémentaires"],
  ["promotions", "Promotions"],
  ["sms", "Notifications SMS"],
  ["quotes", "Demandes de devis"],
  ["fuel_surcharge", "Surcharge carburant"],
  ["route_optimization", "Optimisation des tournées"],
  ["blog", "Blog"],
  ["needs_calculator", "Calculateur de besoin"],
] as const;

function texte(brut: unknown, repli = ""): string {
  return typeof brut === "string" ? brut : repli;
}

function booleen(brut: unknown, repli: boolean): boolean {
  return typeof brut === "boolean" ? brut : repli;
}

function euros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Champ({
  nom,
  libelle,
  valeur,
  type = "text",
  aide,
  step,
  required,
}: {
  nom: string;
  libelle: string;
  valeur: string | number | null;
  type?: string;
  aide?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-cendre-clair block text-[15px] font-semibold">{libelle}</span>
      <Input
        name={nom}
        type={type}
        step={step}
        required={required}
        defaultValue={valeur ?? ""}
        className="mt-2"
      />
      {aide && <span className="text-cendre-clair mt-1.5 block text-[13px] leading-relaxed">{aide}</span>}
    </label>
  );
}

function Interrupteur({ nom, libelle, actif, aide }: { nom: string; libelle: string; actif: boolean; aide?: string }) {
  return (
    <label className="border-ecorce-bord bg-ecorce flex min-h-14 cursor-pointer items-start gap-3 rounded-[6px] border px-4 py-3">
      <input name={nom} type="checkbox" defaultChecked={actif} className="accent-braise mt-0.5 size-5 shrink-0" />
      <span>
        <span className="block text-[15px] font-semibold">{libelle}</span>
        {aide && <span className="text-cendre-clair mt-1 block text-[13px] leading-relaxed">{aide}</span>}
      </span>
    </label>
  );
}

function Carte({
  id,
  titre,
  description,
  Icone,
  action,
  children,
}: {
  id: string;
  titre: string;
  description: string;
  Icone: typeof Building2;
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-ecorce-bord bg-ecorce-eleve scroll-mt-5 rounded-[8px] border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Icone className="text-seve mt-0.5 shrink-0" size={23} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <h2 className="text-[22px]">{titre}</h2>
          <p className="text-cendre-clair mt-1 max-w-[72ch] text-[15px] leading-relaxed">{description}</p>
        </div>
      </div>
      <form action={action} className="mt-6">
        {children}
        <div className="border-ecorce-bord mt-6 border-t pt-5">
          <Button type="submit" variant="cta">Enregistrer cette rubrique</Button>
        </div>
      </form>
    </section>
  );
}

export default async function PageReglages({ searchParams }: PageProps<"/admin/reglages">) {
  const session = await requireRole(["owner"], "/admin/reglages");
  const enregistre = (await searchParams).enregistre;
  const supabase = createSupabaseAdminClient();
  const [entrepriseResult, themeResult, featuresResult, bruts, commandes, paiement, rangement] = await Promise.all([
    supabase.from("companies").select("*").eq("id", session.companyId).single(),
    supabase.from("company_themes").select("*").eq("company_id", session.companyId).maybeSingle(),
    supabase.from("company_features").select("*").eq("company_id", session.companyId).maybeSingle(),
    getRawSettings(session.companyId),
    getOrderSettings(session.companyId),
    getPaymentSettings(session.companyId),
    getRangementSettings(session.companyId),
  ]);
  const entreprise = entrepriseResult.data;
  if (!entreprise) throw new Error("Entreprise introuvable.");
  const theme = themeResult.data;
  const features = featuresResult.data;
  const tokens: Record<string, string> = {
    ...TOKENS_PAR_DEFAUT,
    ...((theme?.tokens as Record<string, string> | null) ?? {}),
  };

  return (
    <main className="p-5 sm:p-8">
      <h1 className="text-[28px] sm:text-[36px]">Réglages</h1>
      <p className="text-cendre-clair mt-2 max-w-[74ch] text-[17px] leading-relaxed">
        Modifiez ici l’identité visible du site, les règles de commande, les paiements et les fonctions actives. Les changements sont appliqués sans redéploiement.
      </p>
      {typeof enregistre === "string" && (
        <p role="status" className="border-succes/30 bg-succes/10 text-succes mt-5 max-w-[1120px] rounded-[6px] border px-4 py-3 text-[15px] font-semibold">
          Réglages enregistrés. Les changements sont déjà actifs sur le site.
        </p>
      )}

      <nav aria-label="Rubriques des réglages" className="mt-6 flex flex-wrap gap-2">
        {[
          ["entreprise", "Entreprise"], ["apparence", "Nom et logo"], ["commandes", "Commandes"],
          ["paiement", "Paiement"], ["notifications", "Notifications"], ["fonctionnalites", "Fonctionnalités"],
        ].map(([id, libelle]) => (
          <a key={id} href={`#${id}`} className="border-ecorce-bord bg-ecorce-eleve hover:bg-ecorce flex min-h-11 items-center rounded-[4px] border px-4 text-[15px] font-semibold">
            {libelle}
          </a>
        ))}
      </nav>

      <div className="mt-7 grid max-w-[1120px] gap-6">
        <Carte id="entreprise" titre="Entreprise et coordonnées" description="Informations utilisées dans l’administration, les documents commerciaux et les notifications." Icone={Building2} action={enregistrerEntreprise}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Champ nom="legalName" libelle="Raison sociale" valeur={entreprise.legal_name} />
            <Champ nom="email" libelle="E-mail de contact" valeur={entreprise.email} type="email" required />
            <Champ nom="siret" libelle="SIRET" valeur={entreprise.siret} />
            <Champ nom="rcs" libelle="RCS" valeur={entreprise.rcs} />
            <Champ nom="vatNumber" libelle="Numéro de TVA" valeur={entreprise.vat_number} />
            <Champ nom="apeCode" libelle="Code APE" valeur={entreprise.ape_code} />
            <Champ nom="phone" libelle="Téléphone brut" valeur={entreprise.phone} type="tel" />
            <Champ nom="phoneDisplay" libelle="Téléphone affiché" valeur={entreprise.phone_display} type="tel" />
            <Champ nom="addressLine1" libelle="Adresse du dépôt" valeur={entreprise.address_line1} />
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Champ nom="postalCode" libelle="Code postal" valeur={entreprise.postal_code} />
              <Champ nom="city" libelle="Ville" valeur={entreprise.city} />
            </div>
            <Champ nom="depotLat" libelle="Latitude du dépôt" valeur={entreprise.depot_lat} type="number" step="0.000001" />
            <Champ nom="depotLng" libelle="Longitude du dépôt" valeur={entreprise.depot_lng} type="number" step="0.000001" />
          </div>
        </Carte>

        <Carte id="apparence" titre="Nom, logo et couleurs" description="Le nom et le logo remplacent immédiatement la marque cliquable qui ramène à l’accueil du site." Icone={Palette} action={enregistrerApparence}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Champ nom="name" libelle="Nom affiché de la société" valeur={entreprise.name} required />
            <Champ nom="tagline" libelle="Sous-titre de la marque" valeur={texte(bruts["branding.tagline"], "Bois de chauffage")} />
            <div className="sm:col-span-2">
              <Champ nom="logoUrl" libelle="Adresse du logo" valeur={texte(bruts["branding.logo_url"])} aide="Adresse https:// d’un logo hébergé ou chemin du site commençant par /. Laissez vide pour afficher l’icône sapin." />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["ecorce", "Écorce"], ["aubier", "Aubier"], ["sapin", "Sapin"],
              ["braise", "Braise"], ["braiseTexte", "Braise texte", "braise-texte"], ["seve", "Sève"],
            ].map(([nom, libelle, cle]) => (
              <label key={nom} className="border-ecorce-bord bg-ecorce flex items-center gap-3 rounded-[6px] border p-3">
                <input name={nom} type="color" defaultValue={tokens[cle ?? nom]} className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent" />
                <span className="text-[15px] font-semibold">{libelle}</span>
              </label>
            ))}
          </div>
        </Carte>

        <Carte id="commandes" titre="Commandes et rangement" description="Délais, minimums généraux et prix TTC du service de rangement. Ce prix est multiplié par le volume apparent commandé." Icone={ShoppingCart} action={enregistrerCommandes}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Champ nom="leadTimeDays" libelle="Délai minimum (jours)" valeur={commandes.leadTimeDays} type="number" step="1" />
            <Champ nom="bookingHorizonDays" libelle="Horizon des créneaux (jours)" valeur={commandes.bookingHorizonDays} type="number" step="1" />
            <Champ nom="minAmountEuros" libelle="Commande minimum (€)" valeur={euros(commandes.minAmountCents)} step="0.01" />
            <Champ nom="minVolumeM3" libelle="Volume minimum (m³)" valeur={commandes.minVolumeM3} type="number" step="0.1" />
          </div>
          <div className="border-seve/30 bg-seve/8 mt-6 rounded-[8px] border p-4 sm:p-5">
            <Interrupteur nom="stackingEnabled" libelle="Proposer le rangement du bois" actif={rangement.enabled} aide="Le client voit le prix avant de payer ; la ligne est conservée sur la commande avec une TVA de 20 %." />
            <div className="mt-4 max-w-sm">
              <Champ nom="stackingPriceEuros" libelle="Prix du rangement par m³ TTC" valeur={euros(rangement.pricePerM3Cents)} step="0.01" aide="Prix de base recommandé : 20,00 € / m³." />
            </div>
          </div>
        </Carte>

        <Carte id="paiement" titre="Paiement et facturation" description="Moyens proposés au client, règles d’acompte et mentions des documents commerciaux." Icone={CreditCard} action={enregistrerPaiementFacturation}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {METHODES.map(([cle, libelle]) => <Interrupteur key={cle} nom={`payment_${cle}`} libelle={libelle} actif={paiement.enabledMethods.includes(cle)} />)}
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Champ nom="cashLimitEuros" libelle="Plafond espèces (€)" valeur={euros(paiement.cashLimitCents)} step="0.01" />
            <Champ nom="depositPercent" libelle="Acompte (%)" valeur={paiement.depositPercent} type="number" step="1" />
            <Champ nom="depositTriggerVolumeM3" libelle="Acompte dès (m³)" valeur={paiement.depositTriggerVolumeM3} type="number" step="0.1" />
            <Champ nom="depositTriggerKm" libelle="Acompte dès (km)" valeur={paiement.depositTriggerKm} type="number" step="1" />
            <Champ nom="invoicePrefix" libelle="Préfixe des factures" valeur={texte(bruts["invoice.prefix"], "FAC")} />
            <label className="block">
              <span className="text-cendre-clair block text-[15px] font-semibold">Régime de TVA</span>
              <select name="vatMode" defaultValue={entreprise.vat_mode} className="border-input bg-card mt-2 h-12 w-full rounded-[4px] border px-3.5 text-[17px]">
                <option value="assujetti">Assujetti à la TVA</option>
                <option value="franchise_en_base">Franchise en base</option>
              </select>
            </label>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label><span className="text-cendre-clair block text-[15px] font-semibold">Pied de facture</span><Textarea name="invoiceFooter" defaultValue={texte(bruts["invoice.footer"])} className="mt-2" /></label>
            <label><span className="text-cendre-clair block text-[15px] font-semibold">Mention des devis PDF</span><Textarea name="quoteDisclaimer" defaultValue={texte(bruts["quote.disclaimer"])} className="mt-2" /></label>
          </div>
        </Carte>

        <Carte id="notifications" titre="Notifications et textes légaux" description="Copies internes, résumé quotidien et références légales utilisées dans le tunnel de commande." Icone={Bell} action={enregistrerNotificationsLegal}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Champ nom="senderName" libelle="Nom de l’expéditeur" valeur={texte(bruts["notifications.sender_name"], entreprise.name)} />
            <Champ nom="copyEmail" libelle="Copie des notifications" valeur={texte(bruts["notifications.copy_email"])} type="email" />
            <Champ nom="digestTime" libelle="Heure du résumé quotidien" valeur={texte(bruts["notifications.digest_time"], "07:00")} type="time" />
            <Champ nom="cgvVersion" libelle="Version des CGV" valeur={texte(bruts["legal.cgv_version"], "2026-08")} />
            <Champ nom="cgvUrl" libelle="Lien vers les CGV" valeur={texte(bruts["legal.cgv_url"], "/cgv")} />
            <Champ nom="privacyUrl" libelle="Lien de confidentialité" valeur={texte(bruts["legal.privacy_url"], "/confidentialite")} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Interrupteur nom="notifyOrderCreated" libelle="Nouvelle commande" actif={booleen(bruts["notifications.order_created"], true)} />
            <Interrupteur nom="notifyPaymentFailed" libelle="Paiement échoué" actif={booleen(bruts["notifications.payment_failed"], true)} />
            <Interrupteur nom="notifyLowStock" libelle="Stock faible" actif={booleen(bruts["notifications.low_stock"], true)} />
          </div>
        </Carte>

        <Carte id="fonctionnalites" titre="Fonctionnalités du site" description="Ces interrupteurs activent les modules prévus par l’architecture multi-entreprises." Icone={SlidersHorizontal} action={enregistrerFonctionnalites}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FONCTIONNALITES.map(([cle, libelle]) => (
              <Interrupteur key={cle} nom={`feature_${cle}`} libelle={libelle} actif={features?.[cle] ?? false} />
            ))}
          </div>
        </Carte>
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Loader2, MailPlus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import {
  changerRoleMembre,
  inviterMembre,
  retirerMembre,
  revoquerInvitation,
} from "@/server/actions/admin-membres";
import { DESCRIPTIONS_ROLE, LIBELLES_ROLE, ROLES_ADMIN, type RoleMembre } from "@/lib/roles";
import type { Invitation, Membre } from "@/server/membres";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Utilisateurs de l'entreprise — réservé au gérant.
 *
 * Chaque rôle est décrit en toutes lettres à côté de son nom : « Secrétariat »
 * ne dit rien à quelqu'un qui doit décider s'il donne accès aux factures ou non
 * (docs/05 §1). Les actions destructrices demandent confirmation et expliquent
 * ce qu'elles retirent.
 */

const ROLES = ROLES_ADMIN;

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function PanneauUtilisateurs({
  membres,
  invitations,
}: {
  membres: Membre[];
  invitations: Invitation[];
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleMembre>("staff");

  const lancer = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setMessage(null);
    demarrer(async () => {
      const resultat = await fn();
      setMessage({
        ton: resultat.ok ? "ok" : "erreur",
        texte: resultat.message ?? (resultat.ok ? "C'est fait." : "L'opération a échoué."),
      });
      if (resultat.ok) setEmail("");
    });
  };

  return (
    <div className="space-y-8">
      {/* ---- Équipe en place ---- */}
      <div>
        <h3 className="text-[17px]">Personnes ayant accès</h3>
        <ul className="mt-4 space-y-3">
          {membres.map((membre) => (
            <li
              key={membre.userId}
              className="border-ecorce-bord rounded-[12px] border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">
                    <UserRound size={17} strokeWidth={1.9} className="text-cendre-clair shrink-0" aria-hidden="true" />
                    {membre.nomComplet ?? membre.email}
                    {membre.estMoi && (
                      <span className="text-cendre-clair text-[13px] font-normal">(vous)</span>
                    )}
                  </p>
                  <p className="text-cendre-clair mt-1 truncate text-[14px]">{membre.email}</p>
                  <p className="text-cendre-clair mt-1 text-[12px]">
                    Membre depuis le {formatDate.format(new Date(membre.depuis))}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${membre.userId}`}>
                    Rôle de {membre.email}
                  </label>
                  <select
                    id={`role-${membre.userId}`}
                    value={membre.role}
                    disabled={enCours}
                    onChange={(evenement) =>
                      lancer(() =>
                        changerRoleMembre({
                          userId: membre.userId,
                          role: evenement.target.value as RoleMembre,
                        }),
                      )
                    }
                    className="border-input bg-card h-11 rounded-[6px] border px-3 text-[15px]"
                  >
                    {ROLES.map((valeur) => (
                      <option key={valeur} value={valeur}>
                        {LIBELLES_ROLE[valeur]}
                      </option>
                    ))}
                  </select>

                  {!membre.estMoi && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Retirer l'accès de ${membre.email}`}
                      disabled={enCours}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Retirer l'accès de ${membre.email} ?\n\n` +
                              `Cette personne ne pourra plus ouvrir l'administration. ` +
                              `Son compte et l'historique de ses actions sont conservés.`,
                          )
                        ) {
                          return;
                        }
                        lancer(() => retirerMembre({ userId: membre.userId }));
                      }}
                    >
                      <Trash2 size={18} strokeWidth={1.9} />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-cendre-clair mt-3 text-[13px] leading-relaxed">
                {DESCRIPTIONS_ROLE[membre.role]}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Invitations en attente ---- */}
      {invitations.length > 0 && (
        <div>
          <h3 className="text-[17px]">Invitations en attente</h3>
          <ul className="mt-4 space-y-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="border-ecorce-bord flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{invitation.email}</p>
                  <p className="text-cendre-clair mt-1 text-[13px]">
                    {LIBELLES_ROLE[invitation.role]} ·{" "}
                    {invitation.expiree ? (
                      <span className="text-alerte">
                        expirée le {formatDate.format(new Date(invitation.expireLe))}
                      </span>
                    ) : (
                      `valable jusqu'au ${formatDate.format(new Date(invitation.expireLe))}`
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={enCours}
                  onClick={() => lancer(() => revoquerInvitation({ invitationId: invitation.id }))}
                >
                  Annuler
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-cendre-clair mt-3 text-[13px] leading-relaxed">
            L&apos;accès s&apos;ouvre à la première connexion de la personne, avec cette adresse
            email. Aucun lien d&apos;accès ne circule par email.
          </p>
        </div>
      )}

      {/* ---- Inviter ---- */}
      <div className="border-ecorce-bord border-t pt-6">
        <h3 className="flex items-center gap-2 text-[17px]">
          <MailPlus size={19} strokeWidth={1.75} className="text-seve" aria-hidden="true" />
          Inviter quelqu&apos;un
        </h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <div>
            <Label htmlFor="invitation-email">Adresse email</Label>
            <Input
              id="invitation-email"
              type="email"
              value={email}
              onChange={(evenement) => setEmail(evenement.target.value)}
              placeholder="prenom@exemple.fr"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="invitation-role">Rôle</Label>
            <select
              id="invitation-role"
              value={role}
              onChange={(evenement) => setRole(evenement.target.value as RoleMembre)}
              className="border-input bg-card mt-2 h-12 w-full rounded-[6px] border px-3 text-[17px]"
            >
              {ROLES.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {LIBELLES_ROLE[valeur]}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            disabled={enCours || email.trim().length === 0}
            onClick={() => lancer(() => inviterMembre({ email, role }))}
          >
            {enCours ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Envoyer l&apos;invitation
          </Button>
        </div>

        <p className="text-cendre-clair mt-3 text-[13px] leading-relaxed">
          {DESCRIPTIONS_ROLE[role]}
        </p>
      </div>

      <div className="border-seve/30 bg-seve/8 flex items-start gap-3 rounded-[12px] border p-4">
        <ShieldCheck size={19} strokeWidth={1.75} className="text-seve mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-[13px] leading-relaxed">
          L&apos;entreprise garde toujours au moins un gérant, et personne ne peut se retirer
          soi-même : c&apos;est ce qui évite de perdre l&apos;accès aux réglages et à la
          facturation par une fausse manœuvre.
        </p>
      </div>

      {message && (
        <p
          role="status"
          className={`text-[15px] ${message.ton === "ok" ? "text-succes" : "text-alerte"}`}
        >
          {message.texte}
        </p>
      )}
    </div>
  );
}

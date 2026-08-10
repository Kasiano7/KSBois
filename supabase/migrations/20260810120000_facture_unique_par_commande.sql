-- ============================================================================
-- Une seule facture par commande — garantie par la BASE, pas par le code
--
-- `emettreFactureCommande()` vérifie qu'aucune facture n'existe avant d'en
-- créer une. Entre cette lecture et l'écriture, rien n'empêchait deux appels
-- concurrents de passer tous les deux : double clic sur « Émettre la facture »,
-- ou passage à « livrée » rejoué pendant que la première insertion est en vol.
-- On obtenait alors DEUX factures pour la même vente, chacune consommant un
-- numéro de la séquence légale.
--
-- C'est exactement le lire-puis-écrire applicatif que PLAN.md (règle 5)
-- interdit pour la numérotation. L'index partiel ci-dessous rend la situation
-- impossible : la seconde insertion échoue, et le code relit puis retourne la
-- facture déjà émise.
--
-- Partiel sur `is_credit_note = false` : une commande porte au plus UNE
-- facture, mais peut porter en plus son avoir.
-- ============================================================================

create unique index if not exists invoices_une_facture_par_commande
  on public.invoices (order_id)
  where is_credit_note = false;

-- Un avoir annule au plus une fois une facture donnée. Même raisonnement :
-- deux avoirs sur la même facture créditeraient le client deux fois.
create unique index if not exists invoices_un_avoir_par_facture
  on public.invoices (parent_invoice_id)
  where parent_invoice_id is not null;

comment on index public.invoices_une_facture_par_commande is
  'Empêche la double facturation d''une commande, y compris sous appels concurrents.';

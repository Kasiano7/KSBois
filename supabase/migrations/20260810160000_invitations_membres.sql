-- ============================================================================
-- Invitations à rejoindre l'administration d'une entreprise
--
-- `company_members` fait le lien entre un compte Supabase Auth existant et une
-- entreprise. Il n'existait aucun moyen d'y ajouter quelqu'un qui n'a pas
-- encore de compte : il fallait passer par la base à la main.
--
-- Une invitation est donc une intention nominative, en attente. Elle se
-- transforme en ligne de `company_members` à la première connexion de la
-- personne, sur l'email VÉRIFIÉ par Supabase Auth — jamais sur une adresse
-- saisie, sinon n'importe qui pourrait réclamer une invitation destinée à un
-- tiers (même raisonnement que le rattachement des commandes invité).
-- ============================================================================

create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email citext not null,
  role text not null check (role in ('owner', 'staff', 'driver')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Une invitation périme : une adresse oubliée pendant six mois ne doit pas
  -- rester une porte ouverte sur l'administration.
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);

-- Une seule invitation vivante par adresse et par entreprise. Sans cet index,
-- inviter deux fois la même personne créerait deux lignes concurrentes et
-- l'acceptation deviendrait ambiguë.
create unique index if not exists company_invitations_une_vivante
  on public.company_invitations (company_id, email)
  where accepted_at is null and revoked_at is null;

create index if not exists company_invitations_email_idx
  on public.company_invitations (email)
  where accepted_at is null and revoked_at is null;

alter table public.company_invitations enable row level security;
alter table public.company_invitations force row level security;

-- Seul le gérant voit et gère les invitations de SON entreprise. Le secrétariat
-- n'a pas à savoir qui est invité, et encore moins à inviter.
drop policy if exists company_invitations_owner on public.company_invitations;
create policy company_invitations_owner on public.company_invitations
  using (public.is_company_owner(company_id))
  with check (public.is_company_owner(company_id));

-- RLS et GRANT sont deux barrières distinctes (docs/01 §4.0) : sans ce GRANT,
-- `service_role` lui-même se voit refuser l'accès.
grant select, insert, update, delete on public.company_invitations to service_role;
revoke all on public.company_invitations from anon;

comment on table public.company_invitations is
  'Invitations à rejoindre l''administration. Consommées à la première connexion, sur l''email vérifié.';

/**
 * Consomme l'invitation d'un utilisateur qui vient de se connecter.
 *
 * Transactionnelle et idempotente : appelée à chaque connexion, elle ne fait
 * rien si la personne est déjà membre. Le rôle d'un membre existant n'est
 * jamais écrasé par une vieille invitation.
 */
create or replace function public.consommer_invitations(
  p_user_id uuid,
  p_email citext
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ajouts integer := 0;
  v_invitation record;
begin
  for v_invitation in
    select id, company_id, role
      from company_invitations
     where email = p_email
       and accepted_at is null
       and revoked_at is null
       and expires_at > now()
     for update
  loop
    insert into company_members (company_id, user_id, role)
    values (v_invitation.company_id, p_user_id, v_invitation.role)
    on conflict (company_id, user_id) do nothing;

    update company_invitations
       set accepted_at = now(), accepted_by = p_user_id
     where id = v_invitation.id;

    v_ajouts := v_ajouts + 1;
  end loop;

  return v_ajouts;
end;
$$;

grant execute on function public.consommer_invitations(uuid, citext) to service_role;

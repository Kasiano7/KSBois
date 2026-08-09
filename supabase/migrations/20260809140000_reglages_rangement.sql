-- Réglages administrables et service de rangement.
-- Le prix est TTC par m³ apparent et reste figé dans order_option_items.

insert into product_options (
  company_id, code, name, description, price_cents, price_type, vat_rate, applies_to, is_active
)
select
  id,
  'rangement',
  'Rangement du bois',
  'Bois transporté et rangé à l''emplacement indiqué par le client.',
  2000,
  'per_m3',
  20.00,
  'order',
  true
from companies
on conflict (company_id, code) do nothing;

insert into company_settings (company_id, key, value)
select id, 'branding.tagline', '"Bois de chauffage"'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, 'branding.logo_url', '""'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, 'payment.enabled_methods', '["cash","check","transfer","sumup","card"]'::jsonb from companies
on conflict (company_id, key) do nothing;

insert into company_settings (company_id, key, value)
select id, cle, valeur
from companies
cross join (
  values
    ('notifications.order_created', 'true'::jsonb),
    ('notifications.payment_failed', 'true'::jsonb),
    ('notifications.low_stock', 'true'::jsonb),
    ('notifications.digest_time', '"07:00"'::jsonb)
) as defaults(cle, valeur)
on conflict (company_id, key) do nothing;

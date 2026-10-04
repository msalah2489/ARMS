-- Sample operational data for ARMS. Run after 001_init.sql in the SQL editor.

insert into public.service_centers (id, name, code, address, contact_name, contact_phone)
values
  ('11111111-1111-1111-1111-111111111111', 'ARMS Central Lab', 'SC-01', 'Beirut Industrial Zone', 'Maya Farhat', '+961 1 555 010')
on conflict (id) do nothing;

insert into public.customers (id, name, contact_name, phone, email, address)
values
  ('22222222-2222-2222-2222-222222222221', 'Maison Aroma', 'Rania El-Khoury', '+961 1 234 567', 'ops@maisonaroma.com', 'Beirut Central District'),
  ('22222222-2222-2222-2222-222222222222', 'Cedar Hotels Group', 'Fadi Mansour', '+961 4 880 120', 'facilities@cedarhotels.com', 'Dbayeh, Metn'),
  ('22222222-2222-2222-2222-222222222223', 'Olive & Oak Retail', 'Sara Daher', '+961 3 441 908', 'stores@oliveoak.com', 'Verdun, Beirut')
on conflict (id) do nothing;

insert into public.branches (id, customer_id, name, code, address, phone)
values
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'BCD Flagship', 'MA-BCD', 'Weygand Street', '+961 1 234 567'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222221', 'ABC Achrafieh', 'MA-ABC', 'ABC Mall', '+961 1 200 300'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Cedar Grand', 'CH-GRD', 'Dbayeh Highway', '+961 4 880 121')
on conflict (id) do nothing;

insert into public.device_models (id, name, brand, model_code, description)
values
  ('44444444-4444-4444-4444-444444444441', 'Nimbus 300', 'AromaTech', 'NIM-300', 'Lobby scent diffuser'),
  ('44444444-4444-4444-4444-444444444442', 'Aura Mini', 'AromaTech', 'AURA-MINI', 'Compact retail diffuser')
on conflict (id) do nothing;

insert into public.devices (
  id, device_code, serial_number, model_id, brand, color, customer_id, branch_id, status, current_location, qr_code
)
values
  ('55555555-5555-5555-5555-555555555551', 'ARMS-10041', 'SN-88421-A', '44444444-4444-4444-4444-444444444441', 'AromaTech', 'Matte Black', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333331', 'under_maintenance', 'Technician van — Karim', 'ARMS-10041'),
  ('55555555-5555-5555-5555-555555555552', 'ARMS-10042', 'SN-88422-B', '44444444-4444-4444-4444-444444444441', 'AromaTech', 'Pearl White', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333332', 'active', 'ABC Achrafieh — lobby', 'ARMS-10042'),
  ('55555555-5555-5555-5555-555555555553', 'ARMS-10055', 'SN-91002-C', '44444444-4444-4444-4444-444444444442', 'AromaTech', 'Sand', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'sent_to_service_center', 'ARMS Central Lab', 'ARMS-10055'),
  ('55555555-5555-5555-5555-555555555554', 'ARMS-10060', 'SN-91088-D', '44444444-4444-4444-4444-444444444442', 'AromaTech', 'Graphite', '22222222-2222-2222-2222-222222222223', null, 'waiting_for_spare_parts', 'Warehouse A', 'ARMS-10060')
on conflict (id) do nothing;

insert into public.spare_parts (id, part_code, name, brand, stock_quantity, minimum_stock, unit)
values
  ('66666666-6666-6666-6666-666666666661', 'FAN-12V', 'Quiet fan assembly', 'AromaTech', 8, 5, 'pcs'),
  ('66666666-6666-6666-6666-666666666662', 'PUMP-MICRO', 'Micro pump kit', 'AromaTech', 2, 4, 'pcs'),
  ('66666666-6666-6666-6666-666666666663', 'NOZ-SET', 'Nozzle set', 'AromaTech', 25, 10, 'set')
on conflict (id) do nothing;

insert into public.service_requests (
  id, request_number, customer_id, branch_id, device_id, reported_problem, priority, status, requested_at
)
values
  ('77777777-7777-7777-7777-777777777771', 'SR-2026-014', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333331', '55555555-5555-5555-5555-555555555551', 'Weak mist output', 'high', 'in_progress', now() - interval '2 days'),
  ('77777777-7777-7777-7777-777777777772', 'SR-2026-015', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555553', 'Noise from fan', 'normal', 'dispatched', now() - interval '5 days'),
  ('77777777-7777-7777-7777-777777777773', 'SR-2026-016', '22222222-2222-2222-2222-222222222223', null, '55555555-5555-5555-5555-555555555554', 'Pump failure after refill', 'urgent', 'waiting_parts', now() - interval '1 day'),
  ('77777777-7777-7777-7777-777777777774', 'SR-2026-017', '22222222-2222-2222-2222-222222222221', '33333333-3333-3333-3333-333333333332', '55555555-5555-5555-5555-555555555552', 'Routine inspection', 'low', 'new', now())
on conflict (id) do nothing;

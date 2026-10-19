-- User-selected prototype reference data based on the approved proposal.
-- These names do not represent a real government's organizational structure.
begin;
insert into public.departments(id,name) values
  ('f1000000-0000-4000-8000-000000000001','Road maintenance'),
  ('f1000000-0000-4000-8000-000000000002','Waste management'),
  ('f1000000-0000-4000-8000-000000000003','Water supply'),
  ('f1000000-0000-4000-8000-000000000004','Sanitation'),
  ('f1000000-0000-4000-8000-000000000005','Public transport'),
  ('f1000000-0000-4000-8000-000000000006','Other public services')
on conflict (name) do nothing;

insert into public.categories(name,description,department_id)
select d.name,case d.name
  when 'Road maintenance' then 'Damaged roads, potholes, pavements and related maintenance.'
  when 'Waste management' then 'Waste collection, overflowing bins and illegal dumping.'
  when 'Water supply' then 'Water leaks, supply interruptions and related service issues.'
  when 'Sanitation' then 'Drainage, wastewater and public sanitation issues.'
  when 'Public transport' then 'Issues with public transport services and facilities.'
  else 'Public service concerns that do not fit another category.' end,d.id
from public.departments d where d.name in ('Road maintenance','Waste management','Water supply','Sanitation','Public transport','Other public services')
on conflict (name) do nothing;
commit;

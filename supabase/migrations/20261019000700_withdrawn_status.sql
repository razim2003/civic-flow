-- Commit the enum addition before the next migration uses the new value.
begin;
alter type public.complaint_status add value 'withdrawn';
commit;

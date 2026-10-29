-- CivicFlow fictional Sri Lankan demonstration data. NOT a migration.
--
-- Purpose: give the Citizen, Officer and Administrator views realistic volume for
-- demonstrations and manual testing (queues, service targets, dispatch, analytics).
--
-- Every person, complaint, remark and rating below is fictional. Places are real
-- Sri Lankan towns/roads with approximate public coordinates; no real resident data.
--
-- How it works
-- * Demo people use ids 5e1a0000-0000-4000-8000-000000000{101..110,201..206}
--   and e-mail addresses on the reserved .test domain. They have no password, so
--   nobody can sign in as them. raw_user_meta_data carries "demo": true.
-- * Demo Officers are only created for departments that have no active Officer
--   when the script runs; departments already staffed keep their own Officers,
--   who then handle the demo complaints there. "Other public services" is left
--   unstaffed on purpose so the Dispatch centre has real coverage gaps to fix.
-- * Complaints are created and processed through the real RPCs (submit, review,
--   priority, start, progress, transfer, assign, resolve, withdraw, feedback), so
--   auto-assignment, history, versions and notifications follow the live rules.
--   Afterwards only timestamps are moved back in time (up to ~6 months) so service
--   targets, overdue flags and the analytics trend have something to show.
-- * Idempotent: if the demo data already exists the script changes nothing.
-- * Atomic: one DO block; any failure rolls everything back.
-- * Remove with supabase/demo/remove-sri-lanka-demo.sql.
do $seed$
declare
  dept constant jsonb := jsonb_build_object(
    'road','f1000000-0000-4000-8000-000000000001','waste','f1000000-0000-4000-8000-000000000002',
    'water','f1000000-0000-4000-8000-000000000003','sanitation','f1000000-0000-4000-8000-000000000004',
    'transport','f1000000-0000-4000-8000-000000000005','other','f1000000-0000-4000-8000-000000000006');
  staffed uuid[];
  p record;
  r record;
  e record;
  c public.complaints;
  citizen uuid;
  officer uuid;
  target uuid;
  category uuid;
  t0 timestamptz;
  span interval;
  ts timestamptz;
  i integer;
begin
  if exists(select 1 from public.profiles where id='5e1a0000-0000-4000-8000-000000000101') then
    raise notice 'CivicFlow Sri Lankan demo data is already present; nothing changed.';
    return;
  end if;
  if (select count(*) from public.departments d where d.is_active
      and d.id in (select (v)::uuid from jsonb_each_text(dept) as x(k,v))) <> 6 then
    raise exception 'demo_requires_default_departments';
  end if;
  select coalesce(array_agg(distinct department_id), '{}') into staffed
    from public.profiles where role='officer' and is_active;

  -- People -------------------------------------------------------------------
  for p in select * from (values
    ('5e1a0000-0000-4000-8000-000000000101'::uuid,'Nimal Perera','nimal.perera',null,210),
    ('5e1a0000-0000-4000-8000-000000000102'::uuid,'Kumari Jayasinghe','kumari.jayasinghe',null,205),
    ('5e1a0000-0000-4000-8000-000000000103'::uuid,'Tharindu Fernando','tharindu.fernando',null,200),
    ('5e1a0000-0000-4000-8000-000000000104'::uuid,'Fathima Rizna','fathima.rizna',null,196),
    ('5e1a0000-0000-4000-8000-000000000105'::uuid,'Kavitha Sivakumar','kavitha.sivakumar',null,190),
    ('5e1a0000-0000-4000-8000-000000000106'::uuid,'Arun Rajaratnam','arun.rajaratnam',null,186),
    ('5e1a0000-0000-4000-8000-000000000107'::uuid,'Dilani Gunasekara','dilani.gunasekara',null,181),
    ('5e1a0000-0000-4000-8000-000000000108'::uuid,'Sahan Bandara','sahan.bandara',null,177),
    ('5e1a0000-0000-4000-8000-000000000109'::uuid,'Ishara Herath','ishara.herath',null,160),
    ('5e1a0000-0000-4000-8000-000000000110'::uuid,'Mohamed Rizwan','mohamed.rizwan',null,150),
    ('5e1a0000-0000-4000-8000-000000000201'::uuid,'Chaminda Abeykoon','chaminda.abeykoon','road',260),
    ('5e1a0000-0000-4000-8000-000000000202'::uuid,'Thushara Weerasinghe','thushara.weerasinghe','waste',255),
    ('5e1a0000-0000-4000-8000-000000000203'::uuid,'Ruwan Karunaratne','ruwan.karunaratne','water',250),
    ('5e1a0000-0000-4000-8000-000000000204'::uuid,'Kavindya Ranasinghe','kavindya.ranasinghe','water',230),
    ('5e1a0000-0000-4000-8000-000000000205'::uuid,'Ahamed Nizar','ahamed.nizar','sanitation',245),
    ('5e1a0000-0000-4000-8000-000000000206'::uuid,'Shalini Ekanayake','shalini.ekanayake','transport',240)
  ) as t(id,name,handle,dept_key,joined_days) loop
    if p.dept_key is not null and (dept->>p.dept_key)::uuid = any(staffed) then continue; end if;
    ts := now() - make_interval(days => p.joined_days);
    -- No password and an undeliverable .test address: the account cannot sign in.
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,recovery_token,email_change_token_new,email_change)
    values('00000000-0000-0000-0000-000000000000',p.id,'authenticated','authenticated',
      p.handle || '@demo.civicflow.test','',ts,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name',p.name,'demo',true),ts,ts,'','','','');
    -- The signup trigger created a Citizen profile; staff the demo Officers directly.
    update public.profiles set created_at=ts,
      role=case when p.dept_key is null then 'citizen' else 'officer' end::public.app_role,
      department_id=(dept->>p.dept_key)::uuid
    where id=p.id;
  end loop;

  -- Complaints ---------------------------------------------------------------
  -- notes[1] = review remark, notes[2..] = progress updates.
  -- reason   = transfer reason (transfer_to set) or withdrawal reason.
  for r in select * from (values
    -- ~6 months ago
    (1,101,'road',172.0,'high','resolved',60,5,'Fixed quickly and the road is safe again. Thank you.',null,
      'Large pothole on the A4 High Level Road near Nugegoda junction. Three-wheelers swerve into oncoming traffic to avoid it.',
      'High Level Road, near Nugegoda junction',6.8728,79.8997,
      array['Inspected the site; the pothole is about one metre wide.','Asphalt patching scheduled for Tuesday night to avoid peak traffic.'],
      'Pothole cut, filled and compacted with hot asphalt. Lane reopened the same night.',null),
    (2,105,'water',165.0,'urgent','resolved',20,4,'Supply came back within a day.',null,
      'Burst water main on Hospital Road, Jaffna. Water has been flowing onto the road since early morning and nearby homes have no supply.',
      'Hospital Road, Jaffna',9.6650,80.0130,
      array['Confirmed burst on the 150 mm main; valve closed to limit loss.','Repair crew on site and the damaged pipe section has been cut out.'],
      'Damaged pipe section replaced and pressure tested. Supply restored to all affected homes.',null),
    (3,103,'waste',158.0,'normal','resolved',190,2,'Collected, but only after two more weeks and several calls.',null,
      'Garbage has not been collected on Lewis Place for two weeks. Bags are piled near the beach access and attract stray dogs and crows.',
      'Lewis Place, Negombo',7.2240,79.8430,
      array['Collection route checked; this road was missed after a lorry breakdown.','Replacement lorry requested from the municipal yard.'],
      'Backlog cleared by a special collection round and the road added back to the Tuesday and Friday schedule.',null),
    -- ~5 months ago
    (4,102,'sanitation',148.0,'high','resolved',50,5,'Very responsive team. The drain is flowing now.',null,
      'Blocked roadside drain beside Kandy market is holding stagnant water. Neighbours are worried about dengue mosquito breeding.',
      'Beside the central market, Kandy',7.2930,80.6350,
      array['Site visited; drain blocked by plastic waste and silt.','Drain cleaning team booked together with the public health inspector.'],
      'Drain cleared and flushed, silt removed and the area treated for mosquito larvae.',null),
    (5,107,'transport',140.0,'normal','resolved',120,3,'Better now, though buses are still late sometimes.',null,
      'Route 138 buses regularly skip the Kirulapone halt during the morning peak, leaving school children waiting for a long time.',
      'Kirulapone bus halt, High Level Road',6.8790,79.8770,
      array['Complaint shared with the depot; morning timetable under review.','Inspectors placed at the halt for one week to monitor stopping.'],
      'Depot instructed all route 138 drivers to stop at Kirulapone; an extra 7.15 am bus added for school days.',null),
    (6,109,'road',131.0,'normal','withdrawn',null,null,null,
      'The contractor resurfaced the stretch the next day, so this complaint is no longer needed.',
      'Uneven road surface left behind after pipe-laying work on Peradeniya Road. Motorcycles are slipping on the loose gravel.',
      'Peradeniya Road, Kandy',7.2840,80.6250,null,null,null),
    (7,104,'water',126.0,'low','resolved',300,4,'Pressure is fine in the evenings now.',null,
      'Low water pressure in the evenings on Galle Road, Wellawatte. Upstairs flats receive no water after 6 pm.',
      'Galle Road, Wellawatte, Colombo 6',6.8747,79.8590,
      array['Pressure readings requested for the evening peak.','Readings confirm a partly closed valve at the branch line.'],
      'Branch valve fully opened and a faulty pressure reducer replaced. Evening pressure is back to normal.',null),
    -- ~4 months ago
    (8,106,'road',118.0,'urgent','resolved',18,5,'Excellent - barricades were up within hours.',null,
      'Part of the culvert on Point Pedro Road has collapsed after heavy rain. A deep hole now sits at the edge of the carriageway.',
      'Point Pedro Road, Jaffna',9.6720,80.0300,
      array['Emergency barricades and reflective signs placed around the collapse.','Precast culvert section delivered and installation started.'],
      'Collapsed culvert section replaced, backfilled and the road edge resurfaced.',null),
    (9,108,'waste',110.0,'high','resolved',70,4,'Area is clean now. Please keep checking it.',null,
      'Illegal dumping of construction debris and household waste along the canal bank behind the fish market.',
      'Canal bank behind the central fish market, Peliyagoda',6.9640,79.8810,
      array['Dumping confirmed; about three lorry loads of debris.','Clearing booked with the heavy machinery unit.'],
      'Debris removed, canal bank cleared and a no-dumping notice board installed.',null),
    (10,110,'sanitation',102.0,'normal','resolved',100,null,null,null,
      'The public toilet at the Kurunegala bus stand has no running water and the doors do not lock.',
      'Kurunegala central bus stand',7.4870,80.3640,
      array['Inspected; the pump has failed and two door latches are broken.','Replacement pump ordered.'],
      'New pump installed, water supply restored and all door latches replaced.',null),
    (11,101,'road',95.0,'normal','resolved',96,4,'Good that it was sent to the right team.',
      'The cause is a leaking water main under the road, so Water supply must repair it first.',
      'Water is seeping up through cracks in the road near the Maharagama bus stand and the surface is starting to break apart.',
      'High Level Road, near Maharagama bus stand',6.8480,79.9265,
      array['Leak traced to a water main under the road; the road will be patched after the pipe is repaired.','Leak located with a listening stick; excavation permit approved.'],
      'Leaking joint on the water main repaired. Road surface reinstated over the trench.','water'),
    -- ~3 months ago
    (12,102,'transport',88.0,'low','resolved',280,3,'Fixed, but it took a long time.',null,
      'The roof of the bus shelter at the Galle bus stand is leaking. Passengers get wet while waiting during showers.',
      'Galle central bus stand, opposite Galle Fort',6.0300,80.2150,
      array['Leak confirmed in two roofing sheets.','Roofing sheets included in the monthly maintenance order.'],
      'Damaged roofing sheets replaced and gutters cleaned.',null),
    (13,103,'road',82.0,'high','resolved',110,2,'Took longer than promised.',null,
      'Broken kerb and exposed steel bars on the pavement along Anagarika Dharmapala Mawatha in Matara. A pedestrian tripped last week.',
      'Anagarika Dharmapala Mawatha, Matara',5.9480,80.5440,
      array['Hazard confirmed; temporary warning tape placed.','Waiting for precast kerb stones from the yard.'],
      'Kerb rebuilt with new precast stones and the exposed steel removed.',null),
    (14,105,'waste',76.0,'normal','resolved',150,5,'Collection is regular again. Great job.',null,
      'Communal bins on Stanley Road are overflowing. The collection lorry has not come since last week.',
      'Stanley Road, Jaffna',9.6630,80.0200,
      array['Route checked; collection frequency is too low for this market area.','Proposal to add a second weekly collection approved.'],
      'Bins emptied and collection increased to twice a week for Stanley Road.',null),
    (15,106,'water',70.0,'normal','withdrawn',null,null,null,
      'The water is clear again after the area was flushed, so I am withdrawing this complaint.',
      'Brown, discoloured water comes from the tap in the mornings on Bar Road, Batticaloa.',
      'Bar Road, Batticaloa',7.7170,81.7000,
      array['Water sample requested; line flushing planned for this zone.'],null,null),
    (16,107,'sanitation',64.0,'high','resolved',40,4,'Quick response after the rain.',null,
      'Sewage is overflowing from a manhole on Dockyard Road in Trincomalee after the recent rain.',
      'Dockyard Road, Trincomalee',8.5710,81.2340,
      array['Overflow confirmed; gully sucker requested.','Blockage found downstream and is being cleared.'],
      'Sewer line cleared, manhole cover reseated and the area disinfected.',null),
    -- ~2 months ago
    (17,108,'road',57.0,'normal','resolved',140,4,'Drivers are slowing down now.',null,
      'The pedestrian crossing outside the school on Main Street in Ratnapura has faded and drivers do not slow down.',
      'Main Street, Ratnapura',6.6828,80.3992,
      array['Marking survey done; crossing and stop lines need repainting.','Painting scheduled for the school holiday weekend.'],
      'Crossing and stop lines repainted with reflective paint; school warning signs cleaned.',null),
    (18,109,'transport',53.0,'normal','resolved',160,3,'Somewhat better.',null,
      'A route 120 bus regularly overloads passengers and drives with the door open between Piliyandala and the city.',
      'Piliyandala bus stand',6.8010,79.9220,
      array['Bus identified from the route log; operator informed.','Joint inspection carried out with the route permit office.'],
      'Operator warned in writing; door-closed rule now checked during route inspections.',null),
    (19,110,'water',49.0,'high','resolved',60,5,'Supply restored and we got an update every day.',null,
      'There has been no pipe-borne water for three days in the Kandy Road area of Kegalle town, and no notice was given.',
      'Kandy Road, Kegalle',7.2513,80.3464,
      array['Pump station fault confirmed; water bowsers arranged for the area.','Replacement motor fitted; testing in progress.'],
      'Pump station repaired and supply restored. Advance notices will be posted for future planned cuts.',null),
    (20,104,'waste',45.0,'low','resolved',200,null,null,null,
      'Garden waste and coconut fronds have been left uncollected along the roadside on Puttalam Road, Chilaw.',
      'Puttalam Road, Chilaw',7.5750,79.7950,
      array['Garden waste collection is fortnightly here; added to the next round.','Tractor and trailer booked.'],
      'Garden waste collected and taken to the compost yard.',null),
    (21,101,'sanitation',41.0,'normal','resolved',120,4,'The smell is gone.',null,
      'The open drain beside the market on Kandy Road, Vavuniya is clogged with plastic and smells strongly.',
      'Kandy Road market, Vavuniya',8.7514,80.4971,
      array['Drain inspected; heavy plastic build-up at the culvert mouth.','Cleaning team scheduled with the market committee.'],
      'Drain cleared and a mesh trap fitted at the culvert to catch plastic.',null),
    (22,102,'road',36.0,'normal','resolved',230,2,'Fixed, but only after many days of danger at night.',null,
      'Deep potholes along Lower Street in Badulla make the road unsafe at night, especially for motorcycles.',
      'Lower Street, Badulla',6.9895,81.0550,
      array['Three potholes marked for repair.','Repair delayed by rain; cold mix will be used.'],
      'All three potholes repaired with cold mix asphalt and compacted.',null),
    (23,103,'other',33.0,'normal','submitted',null,null,null,null,
      'Stray dogs gather near the clock tower bus halt in Ampara and chase people waiting for buses in the evening.',
      'Clock tower bus halt, Ampara',7.2980,81.6720,null,null,null),
    (24,106,'transport',31.0,'normal','withdrawn',null,null,null,
      'A new timetable board has now been put up, so this is sorted for me.',
      'The timetable board at the Anuradhapura new bus stand is missing, so passengers cannot see departure times.',
      'New bus stand, Anuradhapura',8.3350,80.4100,null,null,null),
    -- this month
    (25,105,'road',26.0,'high','started',null,null,null,null,
      'A section of the Galle Road at the Panadura bridge approach has sunk and vehicles bottom out on the dip.',
      'Galle Road, Panadura bridge approach',6.7130,79.9040,
      array['Site inspected; settlement is caused by a failed drainage culvert below.','Traffic cones and warning signs placed.','Contractor appointment waiting for approval of the repair estimate.'],null,null),
    (26,107,'waste',22.0,'normal','started',null,null,null,null,
      'Waste collection has stopped on Hill Street, Dehiwala, and some residents have started burning garbage on the roadside.',
      'Hill Street, Dehiwala',6.8510,79.8700,
      array['Route gap confirmed after a change in collection contractor.','Temporary collection arranged twice this week while the new route is fixed.'],null,null),
    (27,108,'water',19.0,'normal','resolved',90,5,'Quick and polite service.',null,
      'The public tap at the Tissa Road junction in Hambantota is leaking and wastes water all day.',
      'Tissa Road junction, Hambantota',6.1240,81.1190,
      array['Leak confirmed at the tap valve.','Replacement valve fitted; monitoring for one day.'],
      'Tap valve replaced and the stand post repaired. No further leakage.',null),
    (28,109,'sanitation',15.0,'urgent','started',null,null,null,null,
      'Flood water mixed with sewage is entering homes in Kaduwela after the canal overflowed.',
      'Avissawella Road, Kaduwela',6.9330,79.9840,
      array['Urgent site visit done; canal outlet blocked by debris.','Pumps deployed and outlet clearing under way.'],null,null),
    (29,110,'road',12.0,'normal','reviewed',null,null,null,null,
      'A damaged speed hump near Katubedda junction in Moratuwa makes cars scrape and swerve to avoid it.',
      'Katubedda junction, Moratuwa',6.7960,79.9010,
      array['Reviewed; speed hump will be rebuilt to the standard profile.'],null,null),
    (30,101,'transport',9.0,'normal','started',null,null,null,null,
      'The bus halt on Yakkala Road in Gampaha has no shelter and the bench is broken.',
      'Yakkala Road, Gampaha',7.0897,79.9925,
      array['Halt included in the shelter improvement list.','Bench replacement ordered; shelter design approved.'],null,null),
    (31,104,'other',8.0,'normal','submitted',null,null,null,null,
      'Several streetlights along the Galle Road near Kalutara bridge are not working and the footpath is completely dark at night.',
      'Galle Road, near Kalutara bridge',6.5830,79.9600,null,null,null),
    (32,102,'water',6.0,'high','reviewed',null,null,null,null,
      'The water meter chamber on Gregory Lake Road in Nuwara Eliya is leaking continuously.',
      'Gregory Lake Road, Nuwara Eliya',6.9600,80.7720,
      array['Reviewed; meter chamber valve likely damaged.'],null,null),
    (33,103,'waste',4.0,'normal','reviewed',null,null,null,null,
      'The collection lorry leaks dirty water along the main road in Kamburupitiya town on every trip.',
      'Main road, Kamburupitiya town',6.0730,80.5640,
      array['Reviewed; lorry tailgate seal to be checked at the yard.'],null,null),
    (34,106,'road',2.0,'normal','submitted',null,null,null,null,
      'Tree roots have lifted the pavement on Sangaraja Mawatha near Kandy Lake, creating a trip hazard.',
      'Sangaraja Mawatha, near Kandy Lake',7.2925,80.6410,null,null,null),
    (35,107,'sanitation',1.0,'high','submitted',null,null,null,null,
      'An overflowing septic tank behind the Matale public market is leaking into the street drain.',
      'Behind the public market, Matale',7.4675,80.6234,null,null,null),
    (36,108,'other',0.5,'normal','submitted',null,null,null,null,
      'A fallen tree branch is blocking half of the footpath on Olcott Mawatha near the Fort railway station.',
      'Olcott Mawatha, Colombo Fort',6.9344,79.8500,null,null,null)
  ) as t(ord,citizen_no,dept_key,days,priority,stage,resolve_h,rating,feedback,reason,
         description,location,lat,lng,notes,resolution,transfer_to)
  order by ord loop
    citizen := ('5e1a0000-0000-4000-8000-000000000' || r.citizen_no)::uuid;
    t0 := now() - make_interval(secs => r.days::float8 * 86400);
    select k.id into strict category from public.categories k
      where k.department_id=(dept->>r.dept_key)::uuid and k.is_active
      order by (k.name = (select d.name from public.departments d where d.id=k.department_id)) desc, k.name limit 1;

    perform set_config('request.jwt.claim.sub', citizen::text, true);
    select * into strict c from public.submit_complaint(category, r.description, r.location, r.lat, r.lng,
      ('5e1a0000-0000-4000-9000-' || lpad(r.ord::text, 12, '0'))::uuid);

    if r.transfer_to is not null then
      if c.assigned_officer_id is null then raise exception 'demo_department_unstaffed: %', r.dept_key; end if;
      perform set_config('request.jwt.claim.sub', c.assigned_officer_id::text, true);
      select k.id into strict category from public.categories k
        where k.department_id=(dept->>r.transfer_to)::uuid and k.is_active
        order by (k.name = (select d.name from public.departments d where d.id=k.department_id)) desc, k.name limit 1;
      select * into strict c from public.transfer_complaint(c.id, (dept->>r.transfer_to)::uuid, category, c.version, r.reason);
      select p2.id into target from public.profiles p2
        where p2.role='officer' and p2.is_active and p2.department_id=(dept->>r.transfer_to)::uuid
        order by p2.created_at, p2.id limit 1;
      if target is null then raise exception 'demo_department_unstaffed: %', r.transfer_to; end if;
      perform set_config('request.jwt.claim.sub', target::text, true);
      select * into strict c from public.assign_complaint(c.id, target, c.version, null);
    end if;
    officer := c.assigned_officer_id;
    if (r.notes is not null or r.priority <> 'normal') and officer is null then
      raise exception 'demo_department_unstaffed: %', r.dept_key;
    end if;

    if r.notes is not null then
      perform set_config('request.jwt.claim.sub', officer::text, true);
      select * into strict c from public.review_complaint(c.id, c.version, r.notes[1]);
    end if;
    if r.priority <> 'normal' then
      perform set_config('request.jwt.claim.sub', officer::text, true);
      select * into strict c from public.set_complaint_priority(c.id, r.priority::public.complaint_priority, c.version,
        case r.priority when 'urgent' then 'Raised to urgent: immediate risk to public safety or health.'
          when 'high' then 'Raised to high: affects many residents and is getting worse.'
          else 'Set to low: minor issue with no safety risk.' end);
    end if;
    if r.stage in ('started','resolved') then
      select * into strict c from public.start_complaint(c.id, c.version, 'Work order issued and repair work has started.');
      for i in 2..coalesce(array_length(r.notes, 1), 1) loop
        select * into strict c from public.add_progress(c.id, r.notes[i], c.version);
      end loop;
    end if;
    if r.stage = 'resolved' then
      select * into strict c from public.resolve_complaint(c.id, r.resolution, c.version);
      if r.rating is not null then
        perform set_config('request.jwt.claim.sub', citizen::text, true);
        perform public.submit_feedback(c.id, r.rating, r.feedback);
      end if;
    elsif r.stage = 'withdrawn' then
      perform set_config('request.jwt.claim.sub', citizen::text, true);
      select * into strict c from public.withdraw_complaint(c.id, r.reason, c.version);
    end if;

    -- Move the finished history back in time. Early steps happen quickly; the last
    -- step lands at the resolution time (resolved), within 3 days (withdrawn) or
    -- at 60% of the complaint's age (still open).
    span := case r.stage
      when 'resolved' then make_interval(hours => r.resolve_h)
      when 'withdrawn' then least(make_interval(secs => r.days::float8 * 43200), interval '3 days')
      else make_interval(secs => r.days::float8 * 51840) end;
    for e in select ev.id, ev.complaint_version from public.complaint_events ev where ev.complaint_id=c.id order by ev.complaint_version loop
      ts := t0 + case when c.version = 1 then interval '0'
        else span * power((e.complaint_version - 1)::float8 / (c.version - 1), 1.4) end;
      update public.complaint_events set created_at=ts where id=e.id;
      update public.notifications set created_at=ts,
        read_at=case when ts < now() - interval '3 days' then ts + interval '5 hours' end
        where event_id=e.id;
    end loop;
    update public.complaints set created_at=t0,
      resolved_at=case when status='resolved' then t0 + span end,
      withdrawn_at=case when status='withdrawn' then t0 + span end
      where id=c.id;
    update public.complaint_feedback set created_at=least(t0 + span + interval '20 hours', now() - interval '2 hours')
      where complaint_id=c.id;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  raise notice 'CivicFlow Sri Lankan demo data created.';
end
$seed$;

# Stage 10 – Security assessment

CivicFlow holds personal data (names, emails, complaint locations and descriptions, evidence files) and has three privilege levels, so security was designed in from Sprint 1 rather than added at the end. The design-time risk analysis is in [architecture.md](../architecture.md#security-risks-and-verification). This document gives the guidelines' required threat list, risk assessment, security requirements and the implemented controls with their evidence.

## 10.1 Assets

| Asset | Sensitivity |
| --- | --- |
| Citizen identity (name, email) and complaint location/description | Personal data: high |
| Evidence files (photos, PDFs) | Personal data, may show people or homes: high |
| Workflow integrity (status, assignment, resolution, history) | Accountability: high |
| Administrator/Officer privileges | Privilege: critical |
| Service configuration (categories, departments) | Medium |

## 10.2 Threats and risk assessment

Likelihood (L) and impact (I) are rated 1 (low) to 3 (high); risk = L × I. "Residual" is the rating after the implemented controls.

| ID | Threat (STRIDE) | Scenario | L | I | Risk | Controls | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Elevation of privilege | A Citizen sends `role: administrator` in signup metadata or runs `UPDATE profiles SET role=…` from the browser console | 3 | 3 | **9** | Signup trigger hard-codes Citizen; no browser UPDATE grant; role changes only through the audited admin RPC, which checks the live Administrator | 1 |
| T2 | Information disclosure (IDOR) | A Citizen changes the complaint ID in the URL or REST query to read another person's complaint, history, evidence or feedback | 3 | 3 | **9** | RLS on every table via `can_read_complaint` (owner / same-department Officer / Admin); child tables inherit; Storage policies check the parent | 1 |
| T3 | Tampering (workflow bypass) | An Officer or Citizen calls PostgREST directly to set `status='resolved'`, skip steps or edit another department's complaint | 2 | 3 | **6** | Direct DML revoked; narrow RPCs with transition rules, department/assignee checks, row locks and expected version | 1 |
| T4 | Spoofing / stale privilege | A deactivated or demoted user keeps using an unexpired JWT | 2 | 3 | **6** | Every policy and RPC re-reads the **live** profile (`is_active`, role, department); no authorisation from JWT claims | 1 |
| T5 | Tampering / XSS | A malicious description, remark, filename or comment contains `<script>` or `onerror` to steal sessions | 2 | 3 | **6** | React text rendering only; no `dangerouslySetInnerHTML`; no string-built map popups; CSP `script-src 'self'`; sessions kept in memory | 1 |
| T6 | Malicious upload / storage abuse | Upload of HTML/SVG/executables, huge files, overwriting someone else's file, or uploading to another path | 2 | 2 | 4 | Private bucket; MIME allow-list (JPEG/PNG/PDF) and 5 MiB limit in the bucket and RPC; server-reserved UUID paths; no UPDATE/DELETE policy; 5-file quota; stored metadata verified at finalize | 2 (content isn't malware-scanned) |
| T7 | Weak authentication | Short or reused passwords; account enumeration via recovery | 2 | 2 | 4 | 12-character minimum; email verification; generic recovery response; Supabase Auth rate limits | 2 |
| T8 | Secret leakage | A service-role key or DB password bundled into the frontend or committed to Git | 1 | 3 | 3 | Only `VITE_` public URL and publishable key; the env validator rejects `sb_secret_` keys; `.env*` git-ignored; the service key only inside the Edge Function runtime | 1 |
| T9 | Denial of service / spam | Mass complaint submission or repeated requests | 2 | 2 | 4 | Auth required for all writes; bounded inputs and pages; idempotent submission; platform rate limits | 3 (no app-level rate limit) |
| T10 | Repudiation | An Officer or Admin denies making a change | 2 | 2 | 4 | Append-only `complaint_events` with actor and time; private `admin_audit_events` with before/after values | 1 |

## 10.3 Security requirements

| ID | Requirement | Threats | Verified by |
| --- | --- | --- | --- |
| SR-01 | Every protected read and write requires an authenticated **and active** profile. | T4 | TC-DB-FND-03, TC-DB-ADM-04, TC-DB-NTF-04 |
| SR-02 | Roles can only be changed by an active Administrator through an audited operation. Signup always creates a Citizen. | T1 | TC-DB-FND-01, TC-DB-FND-04, TC-DB-ADM-01, TC-INT-02 |
| SR-03 | Citizens can read only their own complaints and children. Officers can read only their department's. | T2 | TC-DB-SUB-06, TC-TRK-03, TC-DB-FB-05, TC-INT-01 |
| SR-04 | Browsers have no direct INSERT/UPDATE/DELETE on application tables. Business changes go only through validated RPCs. | T3 | TC-DB-OFF-03, TC-DB-FB-05, TC-DB-CAT-06 |
| SR-05 | Workflow changes enforce valid transitions, assignee rules and optimistic locking. | T3 | TC-DB-OFF-02, TC-DB-OFF-05, TC-INT-04 |
| SR-06 | User-supplied text is never interpreted as HTML. | T5 | TC-TRK-03, TC-NTF-01 |
| SR-07 | Evidence is private, type- and size-limited, stored at server-chosen paths and never overwritten. | T6 | TC-DB-EV-01…06 |
| SR-08 | Passwords are at least 12 characters, and email ownership is verified. | T7 | TC-U-AUTH-01, Auth configuration |
| SR-09 | No secret credential is present in source, the build or browser configuration. | T8 | TC-U-AUTH-01 ("rejects a secret key …"), `.gitignore` |
| SR-10 | All administrative and workflow changes are attributable. | T10 | TC-DB-ADM-02, TC-DB-CAT-01, TC-DB-OFF-01 |
| SR-11 | The last active Administrator cannot be removed, even concurrently. | T1 | TC-DB-ADM-03, TC-INT-08 |

## 10.4 Implemented controls (demonstrable)

The guidelines ask for at least three implemented controls. Eight are implemented. How to demonstrate each one:

| # | Control | Where | How to demonstrate |
| --- | --- | --- | --- |
| C1 | **Row Level Security (role, ownership and department authorisation)** | `supabase/migrations/…0200`, `…0400`, `…200100` (`can_read_complaint`, read policies) | Sign in as Citizen B and open Citizen A's complaint URL: "Complaint unavailable". Run `npm run test:db` and show "isolates Citizens and departments…" passing. |
| C2 | **Protected workflow RPCs** (no direct DML; transitions, assignee, version) | `…20261020000100_officer_processing.sql`, `…0200_officer_resolution.sql` | Send `PATCH /rest/v1/complaints?id=eq.<id>` with a signed-in Officer's token (DevTools → Network → copy as cURL, change it to PATCH `{"status":"resolved"}`): **403 permission denied** (also asserted by the HTTP integration test). A stale tab shows "This complaint changed while you were viewing it". |
| C3 | **Private evidence storage** | `…0500_private_complaint_evidence.sql` | A public object URL (`/storage/v1/object/public/complaint-evidence/…`) is refused because the bucket isn't public. The download works only when signed in as an authorised user. |
| C4 | **Fail-closed live authorisation** | `private.active_role`, checks in every RPC | Deactivate an Officer in User management: their next action is refused without signing them out. |
| C5 | **Input validation in two layers** | Zod `model/*.ts` + SQL CHECK/RPC | Submit a 5-character description: client error. The same request sent directly gets `invalid_input`. |
| C6 | **XSS defences** | React text rendering, CSP in `vercel.json` | A complaint containing `<img src=x onerror=alert(1)>` displays as text (TC-TRK-03, TC-NTF-01). |
| C7 | **Secure session handling** | `shared/lib/supabase/client.ts` (`persistSession:false`), `AuthProvider` | Reloading the page signs you out; no token is stored in localStorage (TC-AUTH-06). |
| C8 | **Audit trails** | `complaint_events`, `private.admin_audit_events` | Every step appears in the complaint history. Category changes write audit rows (TC-DB-CAT-01). |

## 10.5 Security decisions

- **Authorise in the database, not the UI.** The browser is controllable by the user, so any check done only in React can be bypassed. All checks live in PostgreSQL, and the UI only mirrors them.
- **`SECURITY DEFINER` functions are hardened:** empty `search_path`, fully-qualified names, no dynamic SQL, EXECUTE granted only to `authenticated`, and explicit live checks, because definer functions bypass RLS.
- **The service-role key is used in exactly one place** (the invitation Edge Function), and only after it has verified the caller is a live Administrator.
- **Memory-only sessions** trade convenience (re-login after a refresh) for less token exposure on shared devices.
- **Accepted residual risks** for the prototype: no malware scanning of uploads (downloads are attachment-only, and only demo files are used); no app-level rate limiting beyond the Supabase platform's; the default Supabase email sender. These must be addressed before any real public deployment.

## 10.6 Supabase security advisor

Run the Supabase dashboard **Advisors → Security** after each hosted migration. Record the result here, with the date and any warnings and how they were handled.

| Date | Result | Notes |
| --- | --- | --- |
| — | *not run in this session (no project access)* | |

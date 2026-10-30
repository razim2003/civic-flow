// Hand-built SVG/HTML diagrams (UML use case, wireframes, charts, sprint roadmap).
const ink = '#1d2622', green = '#1f5c4a', soft = '#e8f1ee', orange = '#d9531e', paper = '#ffffff', muted = '#5c6862'
const font = "font-family='Segoe UI, Arial, sans-serif'"
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function actor(x, y, label, sub) {
  return `<g stroke='${ink}' stroke-width='2.4' fill='none' stroke-linecap='round'>
    <circle cx='${x}' cy='${y - 52}' r='15' fill='${paper}'/>
    <line x1='${x}' y1='${y - 37}' x2='${x}' y2='${y + 5}'/>
    <line x1='${x - 24}' y1='${y - 22}' x2='${x + 24}' y2='${y - 22}'/>
    <line x1='${x}' y1='${y + 5}' x2='${x - 20}' y2='${y + 38}'/>
    <line x1='${x}' y1='${y + 5}' x2='${x + 20}' y2='${y + 38}'/></g>
    <text x='${x}' y='${y + 64}' text-anchor='middle' ${font} font-size='19' font-weight='700' fill='${ink}'>${label}</text>
    ${sub ? `<text x='${x}' y='${y + 84}' text-anchor='middle' ${font} font-size='14' fill='${muted}'>${sub}</text>` : ''}`
}
function sysActor(x, y, label) {
  return `<rect x='${x - 78}' y='${y - 34}' width='156' height='68' rx='6' fill='#f1efe9' stroke='${ink}' stroke-width='2'/>
  <text x='${x}' y='${y - 8}' text-anchor='middle' ${font} font-size='13' fill='${muted}'>«system»</text>
  <text x='${x}' y='${y + 15}' text-anchor='middle' ${font} font-size='16' font-weight='700' fill='${ink}'>${label}</text>`
}
function uc(x, y, id, lines, accent) {
  const t = lines.map((l, i) => `<text x='${x}' y='${y + (i - (lines.length - 1) / 2) * 19 + 13}' text-anchor='middle' ${font} font-size='15.5' fill='${ink}'>${esc(l)}</text>`).join('')
  return `<ellipse cx='${x}' cy='${y}' rx='128' ry='38' fill='${accent ? '#fdeee6' : soft}' stroke='${accent ? orange : green}' stroke-width='2'/>
  <text x='${x}' y='${y - 14}' text-anchor='middle' ${font} font-size='11.5' font-weight='700' fill='${accent ? orange : green}'>${id}</text>${t}`
}
const poly = (pts) => `<polyline points='${pts.map((p) => p.join(',')).join(' ')}' fill='none' stroke='${ink}' stroke-width='1.6'/>`
const assoc = (x1, y1, x2, y2) => `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${ink}' stroke-width='1.6'/>`
function dep(x1, y1, x2, y2, label) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${muted}' stroke-width='1.6' stroke-dasharray='7 5' marker-end='url(#open)'/>
  <rect x='${mx - 46}' y='${my - 12}' width='92' height='22' fill='${paper}'/>
  <text x='${mx}' y='${my + 4}' text-anchor='middle' ${font} font-size='13' font-style='italic' fill='${muted}'>${label}</text>`
}

export function useCaseSvg() {
  const C = [150, 560], O = [1390, 380], A = [1390, 860], AU = [150, 110]
  const U = {
    login: [500, 120], reg: [500, 238], submit: [500, 350], evid: [500, 475], auto: [760, 470], track: [500, 600], inbox: [500, 720], wd: [500, 840], fb: [500, 960],
    manage: [1060, 270], progress: [1060, 385], resolve: [1060, 500], dispatch: [1060, 640], users: [1060, 750], cats: [1060, 860], mon: [1060, 965],
  }
  const body = [
    `<rect x='330' y='55' width='900' height='1015' rx='14' fill='#fbfaf7' stroke='${ink}' stroke-width='2.4'/>`,
    `<text x='352' y='1050' ${font} font-size='20' font-weight='800' fill='${ink}'>«system» CivicFlow – Public Service Complaint &amp; Resolution System</text>`,
    // associations
    ...['login', 'reg', 'submit', 'track', 'inbox', 'wd', 'fb'].map((k) => assoc(C[0] + 30, C[1] - 20, U[k][0] - 128, U[k][1])),
    ...['manage', 'progress', 'resolve'].map((k) => assoc(O[0] - 30, O[1] - 20, U[k][0] + 128, U[k][1])),
    ...['dispatch', 'users', 'cats', 'mon'].map((k) => assoc(A[0] - 30, A[1] - 20, U[k][0] + 128, U[k][1])),
    poly([[O[0] - 22, O[1] - 60], [1290, 136], [622, 136]]),
    poly([[A[0] + 24, A[1] - 30], [1500, 800], [1500, 104], [624, 104]]),
    assoc(AU[0] + 78, AU[1], U.login[0] - 128, U.login[1] - 4),
    dep(U.evid[0], U.evid[1] - 38, U.submit[0], U.submit[1] + 40, '«extend»'),
    dep(U.submit[0] + 120, U.submit[1] + 16, U.auto[0] - 70, U.auto[1] - 32, '«include»'),
    dep(U.dispatch[0] - 128, U.dispatch[1] - 6, U.auto[0] + 60, U.auto[1] + 34, '«extend»'),
    uc(...U.login, 'UC-02', ['Log in / log out']),
    uc(...U.reg, 'UC-01', ['Register account']),
    uc(...U.submit, 'UC-03', ['Submit complaint']),
    uc(...U.evid, 'UC-13', ['Attach evidence']),
    uc(...U.auto, 'UC-16 (CR-006)', ['Auto-assign Officer'], true),
    uc(...U.track, 'UC-04', ['Track complaint']),
    uc(...U.inbox, 'UC-12', ['View updates inbox']),
    uc(...U.wd, 'UC-11', ['Withdraw complaint']),
    uc(...U.fb, 'UC-08', ['Provide feedback']),
    uc(...U.manage, 'UC-05', ['Manage complaint', '(review, assign, priority)']),
    uc(...U.progress, 'UC-06', ['Update progress']),
    uc(...U.resolve, 'UC-07', ['Resolve complaint']),
    uc(...U.dispatch, 'UC-15 (CR-006)', ['Dispatch complaint'], true),
    uc(...U.users, 'UC-09', ['Manage users &', 'invite Officers']),
    uc(...U.cats, 'UC-10', ['Manage categories']),
    uc(...U.mon, 'UC-14', ['Monitoring &', 'analytics']),
    actor(...C, 'Citizen'), actor(...O, 'Public Service', 'Officer'), actor(...A, 'Administrator'), sysActor(...AU, 'Supabase Auth'),
  ].join('')
  return `<svg xmlns='http://www.w3.org/2000/svg' width='1560' height='1110' viewBox='0 0 1560 1110'>
  <defs><marker id='open' viewBox='0 0 12 12' refX='11' refY='6' markerWidth='11' markerHeight='11' orient='auto'><path d='M1 1 L11 6 L1 11' fill='none' stroke='${muted}' stroke-width='1.8'/></marker></defs>
  <rect width='1560' height='1110' fill='white'/>${body}</svg>`
}

export function roadmapSvg() {
  const sprints = [
    ['Sprint 1', 'Foundation & authentication', ['Project scaffold, CI', 'Schema + RLS', 'Register / login / roles', 'Admin user management']],
    ['Sprint 2', 'Complaint submission', ['Complaint form + map', 'Categories & routing', 'Private evidence upload', 'My complaints, withdrawal']],
    ['Sprint 3', 'Complaint processing', ['Officer queues & filters', 'Review · assign · priority', 'Start · progress · transfer', 'Officer invitations']],
    ['Sprint 4', 'Tracking & resolution', ['Resolution workflow', 'Updates inbox', 'Citizen feedback', 'Category management']],
    ['Sprint 5', 'Quality & release', ['CR-006 dispatch & SLA', 'Analytics, map, redesign', 'Security & test report', 'Vercel deployment']],
  ]
  const w = 300, gap = 22, x0 = 20
  const cards = sprints.map(([n, goal, items], i) => {
    const x = x0 + i * (w + gap)
    const c = i === 4 ? orange : green
    return `<rect x='${x}' y='40' width='${w}' height='330' rx='14' fill='white' stroke='${c}' stroke-width='2.2'/>
    <rect x='${x}' y='40' width='${w}' height='70' rx='14' fill='${c}'/><rect x='${x}' y='90' width='${w}' height='20' fill='${c}'/>
    <text x='${x + 20}' y='70' ${font} font-size='15' font-weight='700' fill='#ffffffcc'>${n.toUpperCase()}</text>
    <text x='${x + 20}' y='96' ${font} font-size='19' font-weight='800' fill='white'>${esc(goal)}</text>
    ${items.map((t, k) => `<circle cx='${x + 26}' cy='${148 + k * 52}' r='6' fill='${c}'/><text x='${x + 44}' y='${154 + k * 52}' ${font} font-size='16.5' fill='${ink}'>${esc(t)}</text>`).join('')}
    ${i < 4 ? `<path d='M${x + w + 3} 205 l14 0' stroke='${muted}' stroke-width='3' marker-end='url(#a)'/>` : ''}`
  }).join('')
  const W = x0 * 2 + 5 * w + 4 * gap
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='400' viewBox='0 0 ${W} 400'>
  <defs><marker id='a' viewBox='0 0 10 10' refX='5' refY='5' markerWidth='7' markerHeight='7' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='${muted}'/></marker></defs>
  <rect width='${W}' height='400' fill='white'/>${cards}</svg>`
}

export function testChartSvg() {
  const rows = [['Unit tests (Vitest)', 77, 'validation rules, error mapping, SLA, analytics'], ['Database integration (PGlite)', 147, 'real SQL, RLS, RPCs, rollback, concurrency'], ['System / acceptance (Playwright)', 59, 'end-to-end role journeys in a real browser'], ['HTTP integration (Docker)', 9, 'real JWT + PostgREST races (last run 21 Oct)']]
  const max = 160, x0 = 380, bw = 620
  const bars = rows.map(([l, v, d], i) => {
    const y = 40 + i * 92, w = (v / max) * bw, c = i === 3 ? '#9aa39f' : green
    return `<text x='${x0 - 18}' y='${y + 24}' text-anchor='end' ${font} font-size='18' font-weight='700' fill='${ink}'>${l}</text>
    <text x='${x0 - 18}' y='${y + 46}' text-anchor='end' ${font} font-size='14' fill='${muted}'>${d}</text>
    <rect x='${x0}' y='${y + 6}' width='${w}' height='40' rx='4' fill='${c}'/>
    <text x='${x0 + w + 12}' y='${y + 34}' ${font} font-size='20' font-weight='800' fill='${ink}'>${v}${i === 3 ? '' : ' / ' + v + ' passed'}</text>`
  }).join('')
  return `<svg xmlns='http://www.w3.org/2000/svg' width='1180' height='430' viewBox='0 0 1180 430'><rect width='1180' height='430' fill='white'/>
  <line x1='${x0}' y1='30' x2='${x0}' y2='410' stroke='#c9cec9' stroke-width='1.5'/>${bars}</svg>`
}

// Low-fidelity wireframes: grey boxes, no colour, to show layout intent only.
const wfStyle = `<style>
  body{margin:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif;color:#333}
  .wf{width:1100px;height:680px;border:2px solid #555;border-radius:10px;display:grid;grid-template-columns:200px 1fr;overflow:hidden}
  .side{background:#e4e4e4;border-right:2px solid #555;padding:18px 14px}
  .side b{display:block;font-size:20px;margin-bottom:22px}
  .nav{height:26px;background:#cfcfcf;border-radius:6px;margin:9px 0;font-size:13px;line-height:26px;padding-left:10px}
  .nav.on{background:#9e9e9e;color:#fff}
  .main{padding:22px 26px;display:flex;flex-direction:column;gap:14px}
  .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px dashed #999;padding-bottom:10px;font-size:13px}
  .h1{font-size:26px;font-weight:800}
  .box{border:2px solid #777;border-radius:8px;padding:12px 14px;background:#fafafa;font-size:13px}
  .lbl{font-size:12px;font-weight:700;margin:6px 0 4px}
  .inp{height:30px;border:2px solid #999;border-radius:6px;background:#fff}
  .area{height:70px;border:2px solid #999;border-radius:6px;background:#fff}
  .btn{display:inline-block;padding:8px 18px;border:2px solid #333;border-radius:20px;font-weight:700;font-size:13px;background:#ddd}
  .btn.p{background:#333;color:#fff}
  .map{height:170px;border:2px solid #999;border-radius:6px;background:repeating-linear-gradient(45deg,#eee 0 10px,#e2e2e2 10px 20px);display:grid;place-items:center;font-weight:700;color:#777}
  .row{display:flex;gap:12px}.col{flex:1}
  .note{position:absolute;background:#fff7c2;border:1.5px solid #c9b300;font-size:12px;padding:6px 8px;border-radius:4px;max-width:180px}
  .chip{display:inline-block;border:2px solid #888;border-radius:14px;padding:3px 10px;font-size:12px;margin-right:6px}
  .line{height:10px;background:#d6d6d6;border-radius:5px;margin:6px 0}
</style>`
const side = (items, on) => `<div class='side'><b>CivicFlow</b>${items.map((t, i) => `<div class='nav ${i === on ? 'on' : ''}'>${t}</div>`).join('')}</div>`

export function wireframeComplaint() {
  return `${wfStyle}<div style='position:relative;width:1100px'><div class='wf'>${side(['Overview', 'My complaints', 'Make a complaint', 'Updates (2)', 'Profile'], 2)}
  <div class='main'><div class='top'><span>Citizen workspace</span><span>◐ theme · Alex ●</span></div>
  <div class='h1'>Make a complaint</div>
  <div class='row'><div class='col box'><div class='lbl'>Service category ▾</div><div class='inp'></div><div class='lbl'>Describe the issue (10–5,000)</div><div class='area'></div>
  <div class='lbl'>Location – click the map or enter coordinates</div><div class='map'>MAP (OpenStreetMap)</div>
  <div class='row'><div class='col'><div class='lbl'>Latitude</div><div class='inp'></div></div><div class='col'><div class='lbl'>Longitude</div><div class='inp'></div></div></div>
  <div style='margin-top:12px'><span class='btn p'>Submit complaint</span> <span class='btn'>Use my current location</span></div></div>
  <div class='box' style='width:230px'><b>Before you submit</b><div class='line'></div><div class='line'></div><div class='line' style='width:70%'></div><div class='lbl'>Evidence (after submit)</div><div class='area' style='height:60px;display:grid;place-items:center'>JPEG / PNG / PDF ≤ 5 MiB</div></div></div>
  </div></div>
  <div class='note' style='left:690px;top:600px'>Errors shown under each field; nothing is sent until valid.</div></div>`
}
export function wireframeOfficer() {
  return `${wfStyle}<div style='position:relative;width:1100px'><div class='wf'>${side(['Overview', 'Department complaints', 'Assigned to me', 'Department map', 'Updates'], 1)}
  <div class='main'><div class='top'><span>Officer workspace · Road maintenance</span><span>Sam ●</span></div>
  <div class='row' style='align-items:center'><div class='h1' style='flex:1'>CF-30000000 · Road maintenance</div><span class='chip'>Under review</span><span class='chip'>Due in 2 days</span></div>
  <div class='box'><b>Progress</b><div style='display:flex;justify-content:space-between;margin-top:10px'><span>● Submitted</span><span>● Under review</span><span>○ In progress</span><span>○ Resolved</span></div></div>
  <div class='row'><div class='col box'><b>Complaint</b><div class='line'></div><div class='line'></div><div class='map' style='height:120px'>MAP</div><b>History</b><div class='line'></div><div class='line' style='width:60%'></div></div>
  <div class='box' style='width:300px'><b>Process complaint</b><div class='lbl'>Action ▾ (review · assign · priority · start · progress · transfer · resolve)</div><div class='inp'></div><div class='lbl'>Officer / priority / remark</div><div class='area'></div><div style='margin-top:10px'><span class='btn p'>Save action</span></div></div></div>
  </div></div><div class='note' style='left:760px;top:24px'>Only valid next actions are offered; stale edits keep the text.</div></div>`
}
export function wireframeDispatch() {
  const card = (n, o, warn) => `<div class='box col' style='${warn ? 'border-style:dashed;border-color:#333' : ''}'><b>${n}</b><div style='display:flex;justify-content:space-between;margin-top:8px;font-size:12px'><span>Officers<br/><b>${o}</b></span><span>Open<br/><b>3</b></span><span>Unassigned<br/><b>${warn ? 3 : 0}</b></span></div>${warn ? '<div style="margin-top:6px;font-weight:700">⚠ No Officers</div>' : ''}</div>`
  return `${wfStyle}<div style='position:relative;width:1100px'><div class='wf'>${side(['Overview', 'Dispatch centre', 'Analytics', 'User management', 'Service categories'], 1)}
  <div class='main'><div class='top'><span>Administrator workspace</span><span>Razim ●</span></div>
  <div class='h1'>Dispatch centre</div>
  <div class='row'>${card('Road maintenance', 1)}${card('Water supply', 2)}${card('Other services', 0, true)}</div>
  <div><span class='chip' style='background:#333;color:#fff'>Needs attention 3</span><span class='chip'>Unassigned</span><span class='chip'>Past target</span><span class='chip'>All open</span></div>
  <div class='box'><div class='row' style='align-items:center'><div class='col'><b>CF-1A2B3C4D · Stray dogs near bus halt</b><div style='font-size:12px'>Unassigned · Submitted 33 days ago</div><span class='chip'>No Officers in department</span><span class='chip'>Past service target</span></div><span class='btn p'>Dispatch</span></div>
  <div class='row' style='margin-top:10px'><div class='col'><div class='lbl'>Department ▾</div><div class='inp'></div></div><div class='col'><div class='lbl'>Category ▾</div><div class='inp'></div></div><div class='col'><div class='lbl'>Assign Officer ▾</div><div class='inp'></div></div></div>
  <div class='lbl'>Reason (shared with the citizen)</div><div class='inp'></div></div>
  </div></div><div class='note' style='left:840px;top:250px'>Reason is mandatory and appears in the citizen's history.</div></div>`
}
export function wireframeMobile() {
  return `${wfStyle}<style>.ph{width:330px;height:660px;border:3px solid #444;border-radius:34px;padding:16px;display:flex;flex-direction:column;gap:10px}</style>
  <div style='display:flex;gap:40px;width:780px'>
  <div class='ph'><div class='top'><span>☰ CivicFlow</span><span>●</span></div><div class='h1' style='font-size:22px'>My complaints</div><div class='inp'></div><span class='chip'>All statuses ▾</span>
  ${[1, 2, 3].map(() => `<div class='box'><div style='display:flex;justify-content:space-between'><span class='chip'>CF-…</span><span class='chip'>Submitted</span></div><b>Road maintenance</b><div class='line'></div><div style='border-top:2px dashed #999;margin-top:8px;padding-top:6px;font-size:12px;display:flex;justify-content:space-between'><span>Oct 19</span><span>Due in 2 days</span><b>View ↗</b></div></div>`).join('')}</div>
  <div class='ph' style='background:#666;position:relative'><div style='position:absolute;inset:0 70px 0 0;background:#e4e4e4;border-radius:31px 0 0 31px;padding:22px 16px'><b style='font-size:20px'>CivicFlow ✕</b>${['Overview', 'My complaints', 'Make a complaint', 'Updates', 'Profile', 'Sign out'].map((t) => `<div class='nav'>${t}</div>`).join('')}</div></div>
  </div>`
}

// UML activity diagram with swimlanes (complaint lifecycle).
export function activitySvg() {
  const W = 2200, lanes = [['Citizen', 20, 250], ['CivicFlow system', 250, 470], ['Officer', 470, 780], ['Administrator', 780, 960]]
  const act = (x, y, lines, opt = {}) => {
    const w = opt.w ?? 200, h = 22 * lines.length + 26
    return `<rect x='${x - w / 2}' y='${y - h / 2}' width='${w}' height='${h}' rx='16' fill='${opt.fill ?? soft}' stroke='${opt.stroke ?? green}' stroke-width='2' ${opt.dash ? "stroke-dasharray='8 5'" : ''}/>` +
      lines.map((l, i) => `<text x='${x}' y='${y + (i - (lines.length - 1) / 2) * 22 + 6}' text-anchor='middle' ${font} font-size='17' ${i === lines.length - 1 && opt.boldLast ? "font-weight='700'" : ''} fill='${ink}'>${esc(l)}</text>`).join('')
  }
  const dec = (x, y, lines) => `<polygon points='${x},${y - 46} ${x + 72},${y} ${x},${y + 46} ${x - 72},${y}' fill='white' stroke='${green}' stroke-width='2'/>` +
    lines.map((l, i) => `<text x='${x}' y='${y + (i - (lines.length - 1) / 2) * 19 + 6}' text-anchor='middle' ${font} font-size='15' fill='${ink}'>${esc(l)}</text>`).join('')
  const arrow = (pts, label, lx, ly, dash) => `<polyline points='${pts.map((p) => p.join(',')).join(' ')}' fill='none' stroke='${ink}' stroke-width='2' ${dash ? "stroke-dasharray='8 6'" : ''} marker-end='url(#ah)'/>` +
    (label ? `<rect x='${lx - label.length * 4.4 - 6}' y='${ly - 15}' width='${label.length * 8.8 + 12}' height='22' fill='white'/><text x='${lx}' y='${ly + 2}' text-anchor='middle' ${font} font-size='15' font-style='italic' fill='${muted}'>${esc(label)}</text>` : '')
  const laneSvg = lanes.map(([n, y0, y1], i) => `<rect x='20' y='${y0}' width='${W - 40}' height='${y1 - y0}' fill='${i % 2 ? '#fbfaf7' : 'white'}' stroke='${ink}' stroke-width='1.6'/>
    <rect x='20' y='${y0}' width='56' height='${y1 - y0}' fill='${green}'/>
    <text transform='translate(56 ${(y0 + y1) / 2}) rotate(-90)' text-anchor='middle' ${font} font-size='19' font-weight='700' fill='white'>${n}</text>`).join('')
  const body = [
    laneSvg,
    `<circle cx='140' cy='135' r='16' fill='${ink}'/>`,
    arrow([[156, 135], [208, 135]]),
    act(320, 135, ['Submit complaint', '(category, details, map)'], { w: 220 }),
    arrow([[320, 170], [320, 314]]),
    dec(320, 360, ['Input', 'valid?']),
    arrow([[248, 360], [180, 360], [180, 170], [210, 160]], 'no – field errors', 205, 300),
    arrow([[392, 360], [470, 360]], 'yes', 430, 345),
    act(580, 360, ['Save complaint', 'SUBMITTED', '+ history + update'], { w: 210, boldLast: false }),
    arrow([[580, 314], [580, 175]], 'optional', 620, 250, true),
    act(580, 135, ['Attach evidence', '(private files)'], { w: 200, dash: true }),
    arrow([[685, 360], [742, 360]]),
    dec(815, 360, ['Officer in', 'department?']),
    arrow([[887, 360], [940, 360]], 'yes', 912, 345),
    act(1050, 360, ['Auto-assign least-', 'loaded Officer, notify'], { w: 220 }),
    arrow([[815, 406], [815, 830]], 'no', 840, 600),
    act(815, 870, ['Dispatch centre: route /', 'assign with reason'], { w: 250, fill: '#fdeee6', stroke: orange }),
    arrow([[940, 870], [960, 870], [960, 600], [978, 600]]),
    arrow([[1050, 395], [1050, 560]]),
    act(1080, 600, ['Begin review', 'UNDER REVIEW'], { w: 200, boldLast: true }),
    arrow([[1180, 600], [1244, 600]]),
    dec(1316, 600, ['Right', 'department?']),
    arrow([[1316, 646], [1316, 700]], 'no', 1340, 674),
    act(1316, 735, ['Transfer with reason'], { w: 220 }),
    arrow([[1206, 735], [1060, 735], [1060, 640]], "new dept's Officer", 1130, 715),
    arrow([[1388, 600], [1440, 600]], 'yes', 1414, 585),
    act(1545, 600, ['Set priority, start work', 'IN PROGRESS'], { w: 210, boldLast: true }),
    arrow([[1650, 600], [1690, 600]]),
    act(1775, 600, ['Add progress', 'remarks'], { w: 170 }),
    arrow([[1775, 635], [1775, 662]]),
    dec(1775, 708, ['Work', 'done?']),
    arrow([[1847, 708], [1885, 708], [1885, 620], [1860, 620]], 'no', 1905, 670),
    arrow([[1775, 754], [1775, 766], [2000, 766], [2000, 650]], 'yes', 1890, 766),
    act(2000, 610, ['Resolve', 'RESOLVED'], { w: 150, boldLast: true, fill: '#fdeee6', stroke: orange }),
    arrow([[2000, 575], [2000, 172]]),
    act(2000, 135, ['Rate service', '(once)'], { w: 150 }),
    arrow([[2075, 135], [2118, 135]]),
    act(1180, 135, ['Withdraw with reason', 'WITHDRAWN (final)'], { w: 230, dash: true, boldLast: true }),
    `<text x='1180' y='200' text-anchor='middle' ${font} font-size='14' font-style='italic' fill='${muted}'>optional – any time before resolution</text>`,
    arrow([[1180, 98], [1180, 60], [2140, 60], [2140, 116]], null, 0, 0, true),
    `<circle cx='2140' cy='135' r='17' fill='white' stroke='${ink}' stroke-width='2.5'/><circle cx='2140' cy='135' r='10' fill='${ink}'/>`,
  ].join('')
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='980' viewBox='0 0 ${W} 980'>
  <defs><marker id='ah' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='9' markerHeight='9' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='${ink}'/></marker></defs>
  <rect width='${W}' height='980' fill='white'/>${body}</svg>`
}

// Two-row "snake" process chain: row 1 left→right, row 2 right→left, optional loop back.
export function chainSvg(steps, { perRow = 4, loop = null, w = 250, h = 104, gapX = 70, gapY = 90, accent = [] } = {}) {
  const rows = Math.ceil(steps.length / perRow), W = 40 + perRow * w + (perRow - 1) * gapX + 40, H = 40 + rows * h + (rows - 1) * gapY + (loop ? 70 : 40)
  const pos = steps.map((_, i) => {
    const r = Math.floor(i / perRow), c = r % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
    return [40 + c * (w + gapX), 30 + r * (h + gapY)]
  })
  const boxes = steps.map(([title, sub], i) => {
    const [x, y] = pos[i], hot = accent.includes(i)
    const lines = sub.split('|')
    return `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='14' fill='${hot ? '#fdeee6' : soft}' stroke='${hot ? orange : green}' stroke-width='2.2'/>
    <circle cx='${x + 22}' cy='${y + 22}' r='14' fill='${hot ? orange : green}'/><text x='${x + 22}' y='${y + 28}' text-anchor='middle' ${font} font-size='15' font-weight='800' fill='white'>${i + 1}</text>
    <text x='${x + 44}' y='${y + 29}' ${font} font-size='19' font-weight='800' fill='${ink}'>${esc(title)}</text>
    ${lines.map((l, k) => `<text x='${x + 18}' y='${y + 58 + k * 21}' ${font} font-size='16' fill='${muted}'>${esc(l)}</text>`).join('')}`
  }).join('')
  const arrows = steps.slice(1).map((_, i) => {
    const [x1, y1] = pos[i], [x2, y2] = pos[i + 1]
    if (y1 === y2) return x2 > x1 ? `<line x1='${x1 + w}' y1='${y1 + h / 2}' x2='${x2 - 4}' y2='${y2 + h / 2}' stroke='${ink}' stroke-width='2.4' marker-end='url(#m)'/>` : `<line x1='${x1}' y1='${y1 + h / 2}' x2='${x2 + w + 4}' y2='${y2 + h / 2}' stroke='${ink}' stroke-width='2.4' marker-end='url(#m)'/>`
    return `<line x1='${x1 + w / 2}' y1='${y1 + h}' x2='${x2 + w / 2}' y2='${y2 - 4}' stroke='${ink}' stroke-width='2.4' marker-end='url(#m)'/>`
  }).join('')
  let back = ''
  if (loop) {
    const [lx, ly] = pos[steps.length - 1], [fx, fy] = pos[0], yb = ly + h + 34
    back = `<polyline points='${lx + w / 2},${ly + h} ${lx + w / 2},${yb} 18,${yb} 18,${fy + h / 2} ${fx - 4},${fy + h / 2}' fill='none' stroke='${orange}' stroke-width='2.4' stroke-dasharray='9 6' marker-end='url(#mo)'/>
    <rect x='${W / 2 - 150}' y='${yb - 14}' width='300' height='26' fill='white'/><text x='${W / 2}' y='${yb + 5}' text-anchor='middle' ${font} font-size='16' font-style='italic' fill='${orange}'>${esc(loop)}</text>`
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>
  <defs><marker id='m' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='8' markerHeight='8' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='${ink}'/></marker>
  <marker id='mo' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='8' markerHeight='8' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='${orange}'/></marker></defs>
  <rect width='${W}' height='${H}' fill='white'/>${arrows}${back}${boxes}</svg>`
}
export const scrumSvg = () => chainSvg([
  ['Backlog', 'MoSCoW-ordered items|CF-01 … CF-25'], ['Sprint planning', 'pick stories, write|acceptance criteria'], ['Design', 'SQL contract first,|then the UI flow'], ['Implement', 'new migration + feature|module (ui/app/model/data)'],
  ['Retrospective', 'lessons → backlog|refinement'], ['Sprint review', 'demo the increment|to the team / lecturer'], ['CI must be green', 'GitHub Actions on|every push'], ['Test', 'unit · database ·|browser tests'],
], { loop: 'next sprint', accent: [0] })
export const ciSvg = () => chainSvg([
  ['Push / PR', 'git push to a feature|branch or main'], ['Install', 'npm ci on Node 22|(locked versions)'], ['Lint', 'ESLint, zero|warnings allowed'], ['Typecheck', 'strict TypeScript|app + Edge Function'],
  ['Merge to main', 'only when every|stage is green'], ['System tests', 'Playwright – 59|role journeys'], ['Build + type drift', 'Vite production build|DB types up to date'], ['Unit + DB tests', 'Vitest 77 · PGlite 147|real SQL + RLS'],
], { accent: [4] })
export const maintenanceSvg = () => chainSvg([
  ['Record CR', 'id, requester, date,|description'], ['Impact analysis', 'requirements · design · DB|code · tests · docs'], ['Classify + estimate', 'corrective / adaptive /|perfective / preventive'], ['Approve', 'requester / lecturer|(else close: deferred)'],
  ['Close CR', 'record evidence|and commit hashes'], ['Hosted rollout', 'only after explicit|approval + checksums'], ['Update artefacts', 'RTM · design · test|report · user guide'], ['Implement + test', 'branch, new migration,|regression suite'],
], { accent: [3] })

// UML deployment diagram: 3D nodes with nested execution environments and artifacts.
export function deploymentSvg() {
  const node = (x, y, w, h, stereo, name, fill = '#f8f7f3') => `<polygon points='${x},${y} ${x + 18},${y - 18} ${x + w + 18},${y - 18} ${x + w},${y}' fill='#e3e1d9' stroke='${ink}' stroke-width='2'/>
    <polygon points='${x + w},${y} ${x + w + 18},${y - 18} ${x + w + 18},${y + h - 18} ${x + w},${y + h}' fill='#d4d1c6' stroke='${ink}' stroke-width='2'/>
    <rect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}' stroke='${ink}' stroke-width='2'/>
    <text x='${x + 16}' y='${y + 26}' ${font} font-size='14' fill='${muted}'>${esc(stereo)}</text>
    <text x='${x + 16}' y='${y + 48}' ${font} font-size='19' font-weight='800' fill='${ink}'>${esc(name)}</text>`
  const comp = (x, y, w, h, title, sub, hot) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='6' fill='${hot ? '#fdeee6' : soft}' stroke='${hot ? orange : green}' stroke-width='2'/>
    <rect x='${x + w - 30}' y='${y + 10}' width='18' height='22' fill='white' stroke='${hot ? orange : green}' stroke-width='1.5'/><rect x='${x + w - 35}' y='${y + 14}' width='10' height='5' fill='white' stroke='${hot ? orange : green}' stroke-width='1.5'/><rect x='${x + w - 35}' y='${y + 23}' width='10' height='5' fill='white' stroke='${hot ? orange : green}' stroke-width='1.5'/>
    <text x='${x + 14}' y='${y + 28}' ${font} font-size='17' font-weight='700' fill='${ink}'>${esc(title)}</text>
    ${sub.split('|').map((l, i) => `<text x='${x + 14}' y='${y + 52 + i * 19}' ${font} font-size='14.5' fill='${muted}'>${esc(l)}</text>`).join('')}`
  const link = (pts, label, lx, ly, dash) => `<polyline points='${pts.map((p) => p.join(',')).join(' ')}' fill='none' stroke='${ink}' stroke-width='2' ${dash ? "stroke-dasharray='8 6'" : ''} marker-end='url(#d)'/>` +
    (label ? `<rect x='${lx - label.length * 4.2 - 6}' y='${ly - 15}' width='${label.length * 8.4 + 12}' height='22' fill='white'/><text x='${lx}' y='${ly + 2}' text-anchor='middle' ${font} font-size='15' font-style='italic' fill='${ink}'>${esc(label)}</text>` : '')
  const body = [
    node(40, 300, 360, 260, '«device»', 'Client device'),
    `<rect x='60' y='370' width='320' height='170' rx='4' fill='white' stroke='${ink}' stroke-dasharray='6 4' stroke-width='1.5'/><text x='76' y='394' ${font} font-size='14' fill='${muted}'>«execution environment» Web browser</text>`,
    comp(80, 410, 280, 112, 'CivicFlow SPA', 'React 19 + TypeScript|session in memory only|(Citizen · Officer · Admin)', true),
    node(40, 640, 360, 110, '«external system»', 'OpenStreetMap tiles'),
    node(560, 60, 400, 260, '«cloud node»', 'Vercel Edge Network'),
    comp(580, 130, 360, 82, 'dist/ static bundle', 'index.html · hashed JS/CSS · fonts'),
    comp(580, 222, 360, 82, 'vercel.json', 'SPA rewrite · CSP · X-Frame-Options'),
    node(1080, 60, 400, 260, '«repository»', 'GitHub razim2003/civic-flow'),
    comp(1100, 130, 360, 82, 'Source + migrations', 'React app · supabase/migrations'),
    comp(1100, 222, 360, 82, 'GitHub Actions CI', 'lint · typecheck · tests · build'),
    node(560, 420, 920, 380, '«cloud node»', 'Supabase – project xapqfnumcpjckhpdyuxz'),
    comp(580, 490, 280, 96, 'Auth (GoTrue)', 'JWT · e-mail verification|invitations · recovery'),
    comp(880, 490, 280, 96, 'PostgREST', 'Data API · /rpc endpoints'),
    comp(1180, 490, 280, 130, 'PostgreSQL 17', '8 tables + audit table|RLS · 20 definer RPCs|migrations 001–015', true),
    comp(580, 650, 280, 96, 'Storage', 'private bucket|complaint-evidence'),
    comp(880, 650, 280, 96, 'Edge Functions (Deno)', 'provision-officer'),
    link([[400, 420], [470, 420], [470, 190], [555, 190]], 'HTTPS: load app', 470, 300),
    link([[400, 470], [555, 540]], 'HTTPS + JWT', 470, 492),
    link([[220, 560], [220, 618]], 'HTTPS tiles', 290, 592),
    link([[1080, 190], [965, 190]], 'vercel deploy --prod', 1022, 175),
    link([[1160, 538], [1176, 538]], null, 0, 0),
    link([[880, 700], [868, 700], [868, 622], [720, 622], [720, 592]], null, 0, 0, true),
  ].join('')
  return `<svg xmlns='http://www.w3.org/2000/svg' width='1520' height='830' viewBox='0 0 1520 830'>
  <defs><marker id='d' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='8' markerHeight='8' orient='auto'><path d='M0 0 L10 5 L0 10z' fill='${ink}'/></marker></defs>
  <rect width='1520' height='830' fill='white'/>${body}</svg>`
}

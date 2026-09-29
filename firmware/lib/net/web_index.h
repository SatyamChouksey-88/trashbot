#pragma once

static const char WEB_INDEX[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>TrashBot</title><style>
:root{color-scheme:dark light}
body{font-family:system-ui;margin:0;padding:12px;max-width:420px}
button,input,select{font-size:18px;padding:12px;margin:4px;touch-action:manipulation}
.tab{display:none}.tab.active{display:block}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
#status{font-size:1rem;margin:8px 0;line-height:1.4}
.danger{background:#c62828;color:#fff}
</style></head><body>
<h1>TrashBot</h1>
<nav>
<button type=button onclick="show('drive')">Drive</button>
<button type=button onclick="show('cam')">Camera</button>
<button type=button onclick="show('auto')">Auto</button>
<button type=button onclick="show('cal')">Calibrate</button>
<button type=button onclick="show('log')">Log</button>
<button type=button onclick="show('health')">Health</button>
<button type=button onclick="show('bring')">Bring-up</button>
<button type=button onclick="show('learn')">Learning</button>
</nav>
<section id=drive class="tab active">
<div id=status></div>
<label>Speed <input id=spd type=range min=10 max=80 value=45></label>
<div class=grid>
<button onmousedown="hold(0,gspd())" onmouseup="stop()" ontouchstart="hold(0,gspd())" ontouchend="stop()">FWD</button>
<button onmousedown="hold(-gspd(),0)" onmouseup="stop()">LEFT</button>
<button class=danger onclick="stop()">STOP</button>
<button onmousedown="hold(gspd(),0)" onmouseup="stop()">RIGHT</button>
<button onmousedown="hold(0,-gspd())" onmouseup="stop()">BACK</button>
</div>
<button class=danger onclick="estop()">ESTOP</button>
<button onclick="estopReset()">Reset ESTOP</button>
</section>
<section id=cam class=tab>
<img id=shot width=240 alt=snapshot>
<p id=vis></p>
<label><input type=checkbox id=fake> Fake detector demo (firmware flag via API later)</label>
</section>
<section id=auto class=tab>
<p id=autowarn style="color:#c62828"></p>
<label>Max items <input id=mi type=number value=5 min=1 max=20></label>
<label>Max time(s) <input id=mt type=number value=180 min=10></label>
<button onclick="clean()">Start clean</button><button onclick="stop()">Stop</button>
<pre id=sess></pre>
</section>
<section id=cal class=tab>
<label>Profile <select id=prof><option>tile</option><option>carpet</option><option>custom</option></select>
<button onclick="loadProf()">Load</button><button onclick="saveProf()">Save</button></label>
<button onclick="calib('zone_xmin',{from:'current_target'})">Save scoop zone from target</button>
<label>Servo DOWN <input id=sd type=range min=5 max=175 value=20><button onclick="calib('servo_down',{value:+sd.value})">Save</button></label>
<label>CARRY <input id=sc type=range min=5 max=175 value=100><button onclick="calib('servo_carry',{value:+sc.value})">Save</button></label>
<label>TIP <input id=st type=range min=5 max=175 value=165><button onclick="calib('servo_tip',{value:+st.value})">Save</button></label>
<button onclick="calib('self_echo_cm',{from:'current_distance'})">Self-echo (scoop down first)</button>
</section>
<section id=log class=tab><pre id=logpre></pre></section>
<section id=health class=tab><pre id=healthpre>Loading…</pre><button onclick="loadHealth()">Refresh</button></section>
<section id=learn class=tab>
<pre id=learnpre>Loading…</pre>
<button onclick="loadLearning()">Refresh</button>
<button onclick="resetLearning()">Reset bandit stats</button>
</section>
<section id=bring class=tab>
<p>Wheels off the ground. Manual mode only.</p>
<button onclick="pulseLeft()">Pulse LEFT 30%</button>
<button onclick="pulseRight()">Pulse RIGHT 30%</button>
<label><input type=checkbox id=mli onchange="saveBring()"> Left invert</label>
<label><input type=checkbox id=mri onchange="saveBring()"> Right invert</label>
<label><input type=checkbox id=mswap onchange="saveBring()"> Swap sides</label>
<label><input type=checkbox id=cvf onchange="saveBring()"> Camera flip</label>
<p>Distance: <span id=bdist>—</span> cm (target ~30)</p>
<button onclick="bringComplete()">Finish bring-up</button>
<pre id=bringpre></pre>
</section>
<script>
let holdT,activeTab='drive';
function gspd(){return +document.getElementById('spd').value;}
function show(id){activeTab=id;document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
document.getElementById(id).classList.add('active');}
async function api(p,b,m){const o={method:m|| (b?'POST':'GET'),headers:{}};
if(b){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b);}
const r=await fetch('/api/'+p,o);if(!r.ok)throw new Error(r.status);return r.headers.get('content-type')?.includes('json')?r.json():r;}
async function ensureManual(){await api('mode',{mode:'manual'},'POST');}
async function hold(l,r){clearInterval(holdT);await ensureManual();
const d={left:l,right:r,duration_ms:300};await api('drive',d,'POST');
holdT=setInterval(()=>api('drive',d,'POST'),200);}
async function stop(){clearInterval(holdT);await api('stop',{},'POST');}
async function estop(){await api('estop',{},'POST');}
async function estopReset(){await api('estop/reset',{},'POST');}
async function clean(){await api('clean',{max_items:+mi.value,max_time_s:+mt.value},'POST');}
async function calib(key,body){await api('calib/'+key,body,'POST');alert('Saved '+key);}
async function loadLearning(){try{const l=await api('learning');
learnpre.textContent=JSON.stringify(l,null,2);}catch(e){learnpre.textContent='Learning API unavailable';}}
async function resetLearning(){await api('learning/reset',{},'POST');loadLearning();}
async function loadHealth(){try{const h=await api('health');
healthpre.textContent=h.overall+'\n'+h.checks.map(c=>c.name+': '+c.status+' '+c.value).join('\n');}catch(e){healthpre.textContent='Health error';}}
async function loadBring(){const b=await api('bringup');mli.checked=b.motor_left_invert;mri.checked=b.motor_right_invert;
mswap.checked=b.motor_swap_sides;cvf.checked=b.camera_vflip;bringpre.textContent=JSON.stringify(b,null,2);}
async function saveBring(){await api('bringup',{motor_left_invert:mli.checked,motor_right_invert:mri.checked,motor_swap_sides:mswap.checked,camera_vflip:cvf.checked,camera_hmirror:cvf.checked},'POST');}
async function pulseLeft(){await ensureManual();await api('drive',{left:30,right:0,duration_ms:300},'POST');}
async function pulseRight(){await ensureManual();await api('drive',{left:0,right:30,duration_ms:300},'POST');}
async function bringComplete(){await ensureManual();await api('bringup/complete',{},'POST');alert('Bring-up saved');loadBring();}
async function loadProf(){const s=prof.value;await api('profile/load',{slot:s},'POST');alert('Loaded '+s);}
async function saveProf(){const s=prof.value;await api('profile',{slot:s},'POST');alert('Saved '+s);}
async function poll(){try{
const s=await api('status');
autowarn.textContent=s.bringup_done?'':'Complete Bring-up before auto clean.';
status.textContent='Mode '+s.mode+' | '+s.state+' | '+s.distance_cm+' cm'+(s.estop?' | ESTOP':'');
bdist.textContent=s.distance_cm;
sess.textContent=JSON.stringify(s.session,null,2);
vis.textContent=(s.detector||'')+' '+s.vision_ms+'ms';
if(activeTab==='cam')shot.src='/api/photo?'+Date.now();
if(activeTab==='health')loadHealth();
if(activeTab==='bring')loadBring();
if(activeTab==='learn')loadLearning();
const lg=await api('log?since=0');
logpre.textContent=lg.events.slice(-50).map(e=>e.seq+' '+e.type+(e.reason_text?' '+e.reason_text:'')).join('\n');
}catch(e){status.textContent='API error'}}
setInterval(poll,500);poll();
</script></body></html>
)HTML";

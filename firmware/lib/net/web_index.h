#pragma once

static const char WEB_INDEX[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>TrashBot</title><style>
body{font-family:system-ui;margin:0;padding:12px;background:#111;color:#eee}
button{padding:16px;margin:4px;font-size:18px;touch-action:manipulation}
.tab{display:none}.tab.active{display:block}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;max-width:320px}
#dist{font-size:1.2rem;margin:8px 0}
</style></head><body>
<h1>TrashBot</h1>
<nav><button onclick="show('drive')">Drive</button><button onclick="show('cam')">Camera</button>
<button onclick="show('auto')">Auto</button><button onclick="show('log')">Log</button></nav>
<section id=drive class="tab active"><div id=dist></div>
<div class=grid>
<button onmousedown="hold(0,45)" onmouseup="stop()">&#8593;</button>
<button onmousedown="hold(-45,0)" onmouseup="stop()">&#8592;</button>
<button onclick="estop()">STOP</button>
<button onmousedown="hold(45,0)" onmouseup="stop()">&#8594;</button>
<button onmousedown="hold(0,-45)" onmouseup="stop()">&#8595;</button>
</div></section>
<section id=cam class=tab><img id=shot width=240><p id=vis></p></section>
<section id=auto class=tab>
<button onclick="clean()">Start clean</button><button onclick="stop()">Stop</button><pre id=sess></pre>
</section>
<section id=log class=tab><pre id=logpre></pre></section>
<script>
let spd=45,holdT;
function show(id){document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
document.getElementById(id).classList.add('active');}
async function api(p,b){const o=b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:{};
const r=await fetch('/api/'+p,o);return r.json();}
function hold(l,r){api('drive',{left:l,right:r,duration_ms:300});holdT=setInterval(()=>api('drive',{left:l,right:r,duration_ms:300}),200);}
async function stop(){clearInterval(holdT);await api('stop',{});}
async function estop(){await api('estop',{});}
async function clean(){await api('mode',{mode:'manual'});await api('clean',{max_items:5,max_time_s:180});}
async function poll(){const s=await api('status');
document.getElementById('dist').textContent='State '+s.state+' | '+s.distance_cm+' cm';
document.getElementById('sess').textContent=JSON.stringify(s.session,null,2);
document.getElementById('vis').textContent=s.detector+' '+s.vision_ms+'ms';
if(document.getElementById('cam').classList.contains('active')){
document.getElementById('shot').src='/api/photo?'+Date.now();}
const lg=await fetch('/api/log?since=0').then(r=>r.json());
document.getElementById('logpre').textContent=lg.events.slice(-50).map(e=>e.seq+' '+e.type).join('\n');
}
setInterval(poll,500);poll();
</script></body></html>
)HTML";

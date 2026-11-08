const APP_VERSION="2026.11.09";

const $=id=>document.getElementById(id),L=['A','B','C','D','E'];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let U=null,DB=null,M=null,Q=[],E='',ans={},idx=0,done=false,filter='all',shown=40,saveT=null;
const hash=s=>{let h=5381;for(const c of s)h=((h<<5)+h+c.charCodeAt(0))>>>0;return String(h)};
const show=v=>['login','home','play','result','admin'].forEach(x=>$(x).classList.toggle('hide',x!==v));
const pk=m=>'pq:p:'+U.id+':'+m;

/* ---------- login ---------- */
let LM='student',ACC=[],HIDDEN=[];
const VIS=()=>MODS.filter(m=>!HIDDEN.includes(m.id));
async function saveHidden(){ls.set('pq:hidden',HIDDEN);if(DB){try{await DB.doc('settings/hidden').set({v:JSON.stringify(HIDDEN)})}catch(e){}}}
async function H(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('pq|'+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return hash(s)}}
const ekey=e=>'s_'+hash(e.toLowerCase());
const nm=a=>((a.first||'')+' '+(a.last||'')).trim()||a.name||'';
const digits=s=>String(s||'').replace(/\D/g,'').slice(-10);
const genPw=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>'abcdefghjkmnpqrstuvwxyz23456789'[x%31]).join('');
async function init(){
  try{DB=await claude.use('db')}catch(e){DB=null}
  const s=ls.get('pq:session',null);
  if(s){U=s;enter()}else show('login');
  checkUpdate(false);
  setInterval(()=>checkUpdate(false),1800000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate(false)});
}
async function getAcc(k){
  if(DB){try{const d=await DB.doc('accounts/'+k).get();return d.exists?d.data():null}catch(e){}}
  return ls.get('pq:acc:'+k,null);
}
async function setAcc(k,o){ls.set('pq:acc:'+k,o);if(DB){try{await DB.doc('accounts/'+k).set(o)}catch(e){}}}
async function getProf(k){
  if(DB){try{const d=await DB.doc('profiles/'+k).get();return d.exists?d.data():null}catch(e){return null}}
  return ls.get('pq:prof:'+k,null);
}
async function setProf(k,o){ls.set('pq:prof:'+k,o);if(DB){try{await DB.doc('profiles/'+k).set(o)}catch(e){}}}
async function getAccess(k){
  if(DB){try{const d=await DB.doc('access/'+k).get();if(d.exists)return JSON.parse(d.data().m)}catch(e){}}
  return ls.get('pq:access:'+k,[]);
}
async function setAccess(k,a){ls.set('pq:access:'+k,a);if(DB){try{await DB.doc('access/'+k).set({m:JSON.stringify(a)})}catch(e){}}}
async function emailCfg(){
  if(DB){try{const d=await DB.doc('settings/emailjs').get();if(d.exists)return d.data()}catch(e){}}
  return ls.get('pq:emailjs',null);
}
async function sendEmail(to,name,otp){
  const c=await emailCfg();if(!c||!c.s||!c.t||!c.k)return 'unconfigured';
  try{const r=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({service_id:c.s,template_id:c.t,user_id:c.k,template_params:{to_email:to,to_name:name,otp:otp,message:'Your Revision Quiz OTP is '+otp+'. It is valid for 10 minutes.'}})});
    return r.ok?'sent':'failed'}catch(e){return 'failed'}
}
function setMode(m){LM=m;
  const f=m==='forgot',o=m==='otp',ad=m==='admin';
  $('tStu').classList.toggle('on',!ad);$('tAdm').classList.toggle('on',ad);
  $('lotp').classList.toggle('hide',!o);$('lpin').classList.toggle('hide',f);
  $('lpin').placeholder=o?'New password (6+ characters)':'Password (6+ characters)';
  $('lswitch').classList.toggle('hide',!(f||o));$('lforgot').classList.toggle('hide',m!=='student');
  $('lbtn').textContent=f?'Send OTP to my email':o?'Reset password':'Login';
  $('lhelp').textContent=ad?'Admin login. First time: the email and password you enter create the admin account.':f?'Enter your registered email. We will email you a 6-digit OTP.':o?'Enter the OTP from your email and choose a new password.':'Student login. Your login is created by the admin.';
  $('lmsg').style.color='var(--bad)';$('lmsg').textContent=''}
$('tStu').onclick=()=>setMode('student');$('tAdm').onclick=()=>setMode('admin');
$('lswitch').onclick=()=>setMode('student');$('lforgot').onclick=()=>setMode('forgot');
$('lbtn').onclick=async()=>{
  const em=$('lemail').value.trim().toLowerCase(),pw=$('lpin').value,msg=$('lmsg');
  msg.style.color='var(--bad)';
  if(!/^\S+@\S+\.\S+$/.test(em)){msg.textContent='Enter a valid email address.';return}
  msg.textContent='Please wait…';
  if(LM==='forgot'){
    const k=ekey(em),a=await getAcc(k);
    if(!a){msg.textContent='No account found for this email. Ask the admin to create your login.';return}
    if(!(await emailCfg())?.k){msg.textContent='Email OTP is not set up yet. Please ask the admin to reset your password.';return}
    const otp=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);
    const r={h:await H(otp+k),exp:Date.now()+600000};
    ls.set('pq:otp:'+k,r);if(DB){try{await DB.doc('otps/'+k).set(r)}catch(e){}}
    const st=await sendEmail(em,a.name||'',otp);
    if(st!=='sent'){msg.textContent='Could not send the email right now. Please ask the admin to reset your password.';return}
    setMode('otp');$('lmsg').style.color='var(--ok)';$('lmsg').textContent='OTP sent to your email (check spam too). It is valid for 10 minutes.';return}
  if(LM==='otp'){
    if(pw.length<6){msg.textContent='New password needs at least 6 characters.';return}
    const k=ekey(em);let r=null;
    if(DB){try{const d=await DB.doc('otps/'+k).get();r=d.exists?d.data():null}catch(e){}}
    if(!r)r=ls.get('pq:otp:'+k,null);
    if(!r||Date.now()>r.exp||(await H($('lotp').value.trim()+k))!==r.h){msg.textContent='Wrong or expired OTP.';return}
    const a=await getAcc(k);if(!a){msg.textContent='Account not found.';return}
    a.pw=await H(em+':'+pw);await setAcc(k,a);localStorage.removeItem('pq:otp:'+k);if(DB)try{await DB.doc('otps/'+k).delete()}catch(e){}
    setMode('student');$('lpin').value='';$('lotp').value='';$('lmsg').style.color='var(--ok)';$('lmsg').textContent='Password changed. Please login with your new password.';return}
  if(pw.length<6){msg.textContent='Password must be at least 6 characters.';return}
  const ph=await H(em+':'+pw);
  if(LM==='admin'){
    let a=await getAcc('admin');
    if(a&&a.email){if(a.email!==em||a.pw!==ph){msg.textContent='Wrong admin email or password.';return}}
    else{a={name:'Admin',email:em,pw:ph};await setAcc('admin',a)}
    U={id:'admin',name:'Admin',email:em,admin:true};
  }else{
    const k=ekey(em),a=await getAcc(k);
    if(!a){msg.textContent='No account for this email. Ask the admin to create your login.';return}
    if(a.pw!==ph){msg.textContent='Wrong password.';return}
    U={id:k,name:a.name||a.first||'Student',email:em,admin:false};
  }
  ls.set('pq:session',U);$('lpin').value='';msg.textContent='';enter();
};
$('lout').onclick=()=>{persist(true);ls.set('pq:session',null);location.reload()};

/* ---------- app updates (installed app) ---------- */
const APPV=typeof APP_VERSION==='undefined'?null:APP_VERSION;
if(APPV)$('updChk').classList.remove('hide');
function updNote(h,go){const u=$('upd');u.classList.remove('hide');u.innerHTML=h+(go?' <button class="btn" id="updGo" style="margin-top:8px">Update now</button>':'');if(go)$('updGo').onclick=doUpdate}
async function checkUpdate(manual){
  if(!APPV||location.protocol.indexOf('http')!==0){if(manual)updNote('Updates work in the installed app opened from your web link.');return}
  try{const r=await fetch('version.json?'+Date.now(),{cache:'no-store'});const j=await r.json();
    if(j.v&&j.v!==APPV)updNote('🔔 New version <b>'+esc(j.v)+'</b> is available.'+(j.notes?' '+esc(j.notes):''),true);
    else if(manual)updNote('✔ You have the latest version ('+esc(APPV)+').')}
  catch(e){if(manual)updNote('Could not check for updates. Are you online?')}
}
async function doUpdate(){
  updNote('Updating… please wait');
  try{const c=await caches.open('quiz-app-v1');
    for(const u of ['index.html','app.js','manifest.webmanifest','./']){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;await c.put(u,r)}
  }catch(e){updNote('Could not download the update. Check your internet and try again.');return}
  location.reload();
}
$('updChk').onclick=()=>checkUpdate(true);

async function enter(){
  if(!U.admin){const a=await getAcc(U.id);if(!a){ls.set('pq:session',null);U=null;$('bar2').classList.add('hide');show('login');$('lmsg').textContent='This account was removed by the admin.';return}}
  await loadCustom();
  $('who').textContent=U.name+(U.admin?' (admin)':'');
  $('admBtn').classList.toggle('hide',!U.admin);
  $('bar2').classList.remove('hide');
  ACC=U.admin?MODS.map(m=>m.id):await getAccess(U.id);
  const last=ls.get('pq:last:'+U.id,null);
  if(last&&ACC.includes(last)&&!HIDDEN.includes(last))openMod(last);else home();
}

/* ---------- home ---------- */
async function home(){
  show('home');await loadCustom();
  if(!U.admin)ACC=await getAccess(U.id);
  const ok=VIS().filter(m=>ACC.includes(m.id));
  $('mods').innerHTML=(ok.length?'':'<div class="card">⏳ No tests are unlocked for you yet. Please ask the admin to give you access, then press the <b>Tests</b> button again.</div>')+
  VIS().map(m=>{
    if(!ACC.includes(m.id))return '<div class="card" style="opacity:.55"><b>🔒 '+esc(m.name)+'</b><div class="sub" style="margin:4px 0 0">Locked · ask the admin for access</div></div>';
    const p=ls.get(pk(m.id),{ans:{}}),n=Object.keys(p.ans||{}).length;
    return '<div class="card"><b>'+esc(m.name)+'</b><div class="sub" style="margin:4px 0 10px">'+m.q.length+' questions · answered '+n+(p.done?' · submitted':'')+'</div><button class="btn" data-m="'+m.id+'">'+(p.done?'View result':n?'Continue':'Start')+'</button></div>';
  }).join('');
}
$('cpBtn').onclick=async()=>{const m=$('cpMsg');m.style.color='var(--bad)';const a=await getAcc(U.id);if(!a){m.textContent='Account not found.';return}
  const o=$('cpOld').value,n=$('cpNew').value;if(n.length<6){m.textContent='New password needs at least 6 characters.';return}
  if(a.pw!==await H(U.email+':'+o)){m.textContent='Current password is wrong.';return}
  a.pw=await H(U.email+':'+n);await setAcc(U.id,a);$('cpOld').value=$('cpNew').value='';m.style.color='var(--ok)';m.textContent='Password updated ✔'};
$('mods').onclick=e=>{const b=e.target.closest('button');if(b)openMod(b.dataset.m)};
$('homeBtn').onclick=()=>{persist();ls.set('pq:last:'+U.id,null);M=null;home()};

/* ---------- persistence (survives refresh) ---------- */
function persist(now){
  if(!M)return;
  const d={ans,idx,done};
  ls.set(pk(M.id),d);ls.set('pq:last:'+U.id,M.id);
  if(DB){clearTimeout(saveT);const run=()=>DB.doc('prog/'+U.id+'_'+M.id).set({v:JSON.stringify(d)}).catch(()=>{});
    if(now)run();else saveT=setTimeout(run,700)}
}
async function openMod(id){
  if(!ACC.includes(id)||HIDDEN.includes(id)){home();return}
  M=MODS.find(m=>m.id===id);Q=M.q;E=M.E;
  const d=ls.get(pk(id),{ans:{},idx:0,done:false});
  ans=d.ans||{};idx=Math.min(d.idx||0,Q.length-1);done=!!d.done;filter='all';shown=40;
  ls.set('pq:last:'+U.id,id);
  if(done)finish(true);else{$('mtitle').textContent=M.name;buildPal();render();show('play')}
  if(DB){try{const s=await DB.doc('prog/'+U.id+'_'+id).get();
    if(s.exists&&M&&M.id===id&&!Object.keys(ans).length){const r=JSON.parse(s.data().v);ans=r.ans||{};idx=r.idx||0;done=!!r.done;ls.set(pk(id),r);if(done)finish(true);else render()}}catch(e){}}
}

/* ---------- quiz ---------- */
const img=(q,k)=>k==='E'?E:q.opts[k];
function box(v,lz,st){
  if(v&&!Array.isArray(v)&&typeof v==='object')return '<div class="tbox"'+(st?' style="'+st+'"':'')+'>'+esc(v.t)+'</div>';
  if(typeof v==='string')return '<div class="imgbox"'+(st?' style="'+st+'"':'')+'><img '+(lz?'loading="lazy" ':'')+'src="'+v+'"></div>';
  const W=M.W,r=v[3]/W*100;
  return '<div class="imgbox" style="max-width:480px;'+(st||'')+'"><div style="position:relative;overflow:hidden;height:0;padding-bottom:'+r+'%"><img src="'+(M.sheets||SHEETS)[v[0]]+'" style="position:absolute;left:0;top:0;max-width:none;width:200%;margin-left:-'+(v[1]*100)+'%;margin-top:-'+(v[2]/W*100)+'%"></div></div>';
}

function buildPal(){
  $('pal').innerHTML=Q.map((q,i)=>'<button data-i="'+i+'">'+(i+1)+'</button>').join('');
}
$('pal').onclick=e=>{const b=e.target.closest('button');if(b){idx=+b.dataset.i;render()}};
function render(){
  const q=Q[idx];
  $('prog').textContent='Question '+(idx+1)+' of '+Q.length;
  $('ansct').textContent='Answered: '+Object.keys(ans).length+' / '+Q.length;
  $('barfill').style.width=((idx+1)/Q.length*100)+'%';
  $('qsec').textContent=q.sec||M.name;
  $('stembox').innerHTML=box(q.stem,false);
  $('opts').innerHTML='';
  L.forEach(k=>{if(!img(q,k))return;const b=document.createElement('button');b.className='opt'+(ans[q.n]===k?' sel':'');
    b.innerHTML=box(img(q,k),false);
    b.onclick=()=>{ans[q.n]=k;persist();render()};$('opts').appendChild(b)});
  $('prev').disabled=idx===0;$('next').disabled=idx===Q.length-1;
  [...$('pal').children].forEach((b,i)=>{b.className=(ans[Q[i].n]?'a':'')+(i===idx?' cur':'')});
  persist();
}
$('prev').onclick=()=>{if(idx>0){idx--;render();scrollTo(0,0)}};
$('next').onclick=()=>{if(idx<Q.length-1){idx++;render();scrollTo(0,0)}};
$('clear').onclick=()=>{delete ans[Q[idx].n];render()};
$('submit').onclick=()=>{const left=Q.length-Object.keys(ans).length;
  $('cmsg').textContent=left?'You have '+left+' unanswered question(s). Submit anyway?':'Submit and reveal answers?';
  $('cbox').classList.remove('hide');$('cbox').scrollIntoView({block:'center'})};
$('cno').onclick=()=>$('cbox').classList.add('hide');
$('cyes').onclick=()=>{$('cbox').classList.add('hide');done=true;persist(true);finish(false)};

/* ---------- result ---------- */
const status=q=>{const a=ans[q.n];if(!a)return'skipped';if(a===q.ans)return'correct';if(a==='E')return'skipped';return'wrong'};
async function finish(restored){
  show('result');
  const c={correct:0,wrong:0,skipped:0};Q.forEach(q=>c[status(q)]++);
  $('rtitle').textContent=M.name;
  $('big').textContent=c.correct+' / '+Q.length;
  $('pct').textContent=Math.round(c.correct/Q.length*100)+'% correct';
  $('stats').innerHTML=[['Correct',c.correct],['Wrong',c.wrong],['Skipped / Do not know',c.skipped]].map(x=>'<div class="stat">'+x[0]+'<b>'+x[1]+'</b></div>').join('');
  $('tabs').innerHTML=[['all','All ('+Q.length+')'],['wrong','Wrong ('+c.wrong+')'],['skipped','Skipped ('+c.skipped+')'],['correct','Correct ('+c.correct+')']].map(t=>'<button data-f="'+t[0]+'">'+t[1]+'</button>').join('');
  rev();scrollTo(0,0);
  if(!restored)saveResult(c);
}
function saveResult(c){
  const all=ls.get('pq:res:'+U.id,{});all[M.id]={s:c.correct,t:Q.length,w:c.wrong,k:c.skipped,ts:Date.now()};ls.set('pq:res:'+U.id,all);
  if(DB)DB.doc('results/'+U.id).set({name:U.name,r:JSON.stringify(all)}).catch(()=>{$('shareNote').textContent='Your result could not be shared with the admin (ask the owner for Contributor access).'});
}
$('tabs').onclick=e=>{const b=e.target.closest('button');if(b){filter=b.dataset.f;shown=40;rev()}};
$('more').onclick=()=>{shown+=60;rev()};
function rev(){
  [...$('tabs').children].forEach(b=>b.classList.toggle('on',b.dataset.f===filter));
  const list=Q.filter(q=>filter==='all'||status(q)===filter);
  $('rev').innerHTML=list.slice(0,shown).map(q=>{
    const st=status(q),a=ans[q.n];
    const tg={correct:['✔ Correct','ok'],wrong:['✘ Wrong','bad'],skipped:[a==='E'?'Do not know':'Not answered','']}[st];
    const o=L.map(k=>{if(!img(q,k))return '';let c='opt static';if(k===q.ans)c+=' ok';else if(k===a&&k!=='E')c+=' bad';else if(k===a)c+=' sel';
      return '<div class="'+c+'">'+box(img(q,k),true)+'</div>'}).join('');
    return '<div class="card"><span class="tag">Q'+q.n+'</span> <span class="tag '+tg[1]+'">'+tg[0]+'</span> <span class="tag ok">Correct: '+q.ans+'</span>'+(a&&a!=='E'?' <span class="tag">Yours: '+a+'</span>':'')+''+box(q.stem,true,'margin:10px 0')+''+o+(q.note?'<div class="note"><b>PDF note:</b> '+esc(q.note)+'</div>':'')+'</div>'}).join('')||'<div class="card sub">Nothing here.</div>';
  $('more').classList.toggle('hide',list.length<=shown);
}
$('again').onclick=()=>{ans={};idx=0;done=false;persist(true);buildPal();render();show('play');scrollTo(0,0)};
$('back').onclick=()=>{done=false;persist(true);render();show('play');scrollTo(0,0)};
$('toHome').onclick=()=>{ls.set('pq:last:'+U.id,null);M=null;home()};

/* ---------- admin ---------- */
async function loadAdmin(){
  $('admBody').innerHTML='<div class="sub">Loading…</div>';
  let ac=[],pf={},res={},acs={};
  try{
    if(DB){
      const [a,p,r,c]=await Promise.all([DB.collection('accounts').get(),DB.collection('profiles').get(),DB.collection('results').get(),DB.collection('access').get()]);
      ac=a.docs.filter(d=>d.id!=='admin').map(d=>({id:d.id,...d.data()}));
      p.docs.forEach(d=>pf[d.id]=d.data());
      r.docs.forEach(d=>{try{res[d.id]=JSON.parse(d.data().r)}catch(e){}});
      c.docs.forEach(d=>{try{acs[d.id]=JSON.parse(d.data().m)}catch(e){}});
    }else{
      for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
        if(k.startsWith('pq:acc:s_'))ac.push({id:k.slice(7),...ls.get(k,{})});
        if(k.startsWith('pq:prof:'))pf[k.slice(8)]=ls.get(k,{})}
      ac.forEach(x=>{res[x.id]=ls.get('pq:res:'+x.id,{});acs[x.id]=ls.get('pq:access:'+x.id,[])});
    }
  }catch(e){$('admBody').innerHTML='<div class="card">Could not load data.</div>';return}
  // move details from older accounts into the admin-only profile store
  for(const x of ac){if((x.email||x.mobile||x.first||x.last)&&!pf[x.id]){
      pf[x.id]={first:x.first||x.name||'',last:x.last||'',mobile:x.mobile||'',email:x.email||''};await setProf(x.id,pf[x.id]);
      await setAcc(x.id,{name:pf[x.id].first||x.name||'',pw:x.pw})}}
  const c=(await emailCfg())||{};$('ejS').value=c.s||'';$('ejT').value=c.t||'';$('ejK').value=c.k||'';
  qbList();
  const st=ac.map(x=>({id:x.id,...x,...(pf[x.id]||{})}));
  const att=m=>st.filter(x=>(res[x.id]||{})[m.id]).length;
  const head='<tr><th>Student details</th>'+VIS().map(m=>'<th title="'+esc(m.name)+'">'+esc(m.short)+'<br><span class="sub">'+att(m)+' attended</span></th>').join('')+'<th></th></tr>';
  const body=st.map(x=>{const a=acs[x.id]||[],r=res[x.id]||{};
    return '<tr><td><b>'+esc(nm(x))+'</b><br><span class="sub">📧 '+esc(x.email||'—')+'<br>📱 '+esc(x.mobile||'—')+'</span></td>'+VIS().map(m=>{const v=r[m.id];
      return '<td><input type="checkbox" data-s="'+x.id+'" data-m="'+m.id+'"'+(a.includes(m.id)?' checked':'')+'> '+(v?'<b>'+v.s+'/'+v.t+'</b><br><span class="sub">✔'+v.s+' ✘'+(v.w??'–')+' ⏭'+(v.k??'–')+'<br>'+new Date(v.ts).toLocaleDateString()+'</span>':'<span class="sub">—</span>')+'</td>'}).join('')+
      '<td><button class="btn ghost" data-all="'+x.id+'">All</button> <button class="btn ghost" data-none="'+x.id+'">None</button> <button class="btn ghost" data-pw="'+x.id+'">Reset password</button> <button class="btn ghost" data-del="'+x.id+'">Reset scores</button> <button class="btn ghost" data-rm="'+x.id+'" style="color:var(--bad)">Remove user</button></td></tr>'}).join('');
  $('admBody').innerHTML=st.length?'<div class="sub" style="margin-bottom:8px">'+st.length+' student(s). Tick a box to give access to a test. Scores appear after the student submits.</div><div class="card" style="overflow:auto"><table>'+head+body+'</table></div>':'<div class="card sub">No students yet. Use “Create new user” above.</div>';
  $('admBody').onchange=async e=>{const c=e.target;if(!c.dataset.s)return;
    let a=await getAccess(c.dataset.s);a=a.filter(x=>x!==c.dataset.m);if(c.checked)a.push(c.dataset.m);await setAccess(c.dataset.s,a)};
  $('admBody').onclick=async e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.all){await setAccess(b.dataset.all,VIS().map(m=>m.id));loadAdmin()}
    else if(b.dataset.none){await setAccess(b.dataset.none,[]);loadAdmin()}
    else if(b.dataset.pw){const id=b.dataset.pw,a=await getAcc(id),p=await getProf(id)||{};if(a){const t=genPw(),em=p.email||a.email;
      a.pw=await H(em+':'+t);await setAcc(id,a);
      $('pwMsg').classList.remove('hide');$('pwMsg').innerHTML='New temporary password for <b>'+esc(nm(p)||a.name)+'</b> ('+esc(em)+'): <b style="font-size:18px">'+t+'</b><br>Send it to the student. They can change it after login.';scrollTo(0,0)}}
    else if(b.dataset.rm){if(!b.dataset.sure){b.dataset.sure='1';b.textContent='Sure? Click again';return}await removeUser(b.dataset.rm);loadAdmin()}
    else if(b.dataset.del){const id=b.dataset.del;ls.set('pq:res:'+id,{});if(DB)try{await DB.doc('results/'+id).delete()}catch(er){}loadAdmin()}};
}
$('nAdd').onclick=async()=>{const g=i=>$(i).value.trim(),m=$('nMsg');m.style.color='var(--bad)';
  const f=g('nFirst'),l=g('nLast'),mb=g('nMobile'),em=g('nEmail').toLowerCase();let pw=g('nPass');
  if(!f||!l||!em){m.textContent='First name, last name and email are required.';return}
  if(!/^\S+@\S+\.\S+$/.test(em)){m.textContent='Enter a valid email address.';return}
  if(digits(mb).length<10){m.textContent='Enter a valid 10-digit mobile number.';return}
  if(pw&&pw.length<6){m.textContent='Password needs at least 6 characters.';return}
  const k=ekey(em),old=await getAcc(k),isNew=!old;if(!pw&&isNew)pw=genPw();
  await setProf(k,{first:f,last:l,mobile:mb,email:em});
  await setAcc(k,{name:f,pw:pw?await H(em+':'+pw):old.pw});
  ['nFirst','nLast','nMobile','nEmail','nPass'].forEach(i=>$(i).value='');
  m.style.color='var(--ok)';m.textContent=isNew?'User created.':'Details updated.';
  if(pw){$('pwMsg').classList.remove('hide');$('pwMsg').innerHTML='Login for <b>'+esc(f+' '+l)+'</b><br>Email: <b>'+esc(em)+'</b><br>Password: <b style="font-size:18px">'+esc(pw)+'</b><br>Share this with the student. They can change the password after login.'}
  loadAdmin()};
$('ejSave').onclick=async()=>{const c={s:$('ejS').value.trim(),t:$('ejT').value.trim(),k:$('ejK').value.trim()};ls.set('pq:emailjs',c);
  if(DB)try{await DB.doc('settings/emailjs').set(c)}catch(e){}$('ejMsg').style.color='var(--ok)';$('ejMsg').textContent='Saved.'};
$('ejTest').onclick=async()=>{$('ejMsg').style.color='var(--bad)';$('ejMsg').textContent='Sending…';
  const st=await sendEmail(U.email,'Admin','123456');
  $('ejMsg').textContent=st==='sent'?'✔ Test email sent to '+U.email:st==='unconfigured'?'Save the three EmailJS values first.':'Failed. Check the IDs/key. Email sending works only from the installed/hosted app, not inside claude.ai.';
  if(st==='sent')$('ejMsg').style.color='var(--ok)'};
$('admBtn').onclick=()=>{show('admin');loadAdmin();qbShow('')};
async function removeUser(id){
  const mids=MODS.map(m=>m.id);
  ['pq:acc:'+id,'pq:prof:'+id,'pq:access:'+id,'pq:res:'+id].forEach(k=>localStorage.removeItem(k));mids.forEach(m=>localStorage.removeItem('pq:p:'+id+':'+m));
  if(DB)for(const p of ['accounts/'+id,'profiles/'+id,'access/'+id,'results/'+id,'otps/'+id,...mids.map(m=>'prog/'+id+'_'+m)]){try{await DB.doc(p).delete()}catch(e){}}
}
/* ---------- custom quizzes ---------- */
async function loadCustom(){
  let list=[];
  HIDDEN=ls.get('pq:hidden',[]);
  if(DB){try{const h=await DB.doc('settings/hidden').get();HIDDEN=h.exists?JSON.parse(h.data().v):[]}catch(e){}}
  if(DB){try{const r=await DB.collection('quizzes').get();list=r.docs.map(d=>({id:d.id,name:d.data().name,q:JSON.parse(d.data().q)}))}catch(e){}}
  else list=ls.get('pq:quizzes',[]);
  for(let i=MODS.length-1;i>=0;i--)if(MODS[i].custom)MODS.splice(i,1);
  list.forEach(c=>MODS.push({id:'c_'+c.id,custom:true,cid:c.id,short:c.name.slice(0,10),name:c.name+' ('+c.q.length+' Q)',E:{t:'E) Do not know / விடை தெரியவில்லை'},
    q:c.q.map((x,i)=>{const o={};['a','b','c','d'].forEach((k,j)=>{if(x[k])o['ABCD'[j]]={t:'ABCD'[j]+') '+x[k]}});return{n:i+1,sec:'',stem:{t:(i+1)+'. '+x.q},opts:o,ans:x.ans,note:null}})}));
}
let QB=[];
function rows(t){const d=(t.split('\n')[0]||'').includes('\t')?'\t':',';const out=[];let r=[],f='',q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===d){r.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);f='';if(r.some(x=>x.trim()))out.push(r);r=[]}
    else f+=c}
  r.push(f);if(r.some(x=>x.trim()))out.push(r);return out}
function toQs(text){
  text=text.trim();let items;
  if(text[0]==='[')items=JSON.parse(text).map(x=>[x.q||x.question,x.a||x.A,x.b||x.B,x.c||x.C,x.d||x.D,x.ans||x.answer]);else items=rows(text);
  const out=[];
  items.forEach((r,i)=>{r=r.map(x=>String(x==null?'':x).trim());if(i===0&&/^(question|q)$/i.test(r[0]))return;
    const o=[r[1],r[2],r[3],r[4]];let a=(r[5]||'').toUpperCase();
    if(!(a.length===1&&'ABCD'.includes(a))){const n=parseInt(a);a=n>=1&&n<=4?'ABCD'[n-1]:('ABCD'[o.findIndex(z=>z&&z===r[5])]||'')}
    if(r[0]&&o[0]&&o[1]&&a&&o['ABCD'.indexOf(a)])out.push({q:r[0],a:o[0],b:o[1],c:o[2]||'',d:o[3]||'',ans:a})});
  return out}
function qbShow(m){$('qbList').textContent='Questions in this quiz so far: '+QB.length;$('qbMsg').textContent=m||''}
$('qbFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('qbText').value=String(r.result).replace(/^\uFEFF/,'');qbShow('File loaded. Press "Add these questions".')};r.readAsText(f,'utf-8')};
$('qbParse').onclick=()=>{try{const a=toQs($('qbText').value);QB=QB.concat(a);$('qbText').value='';qbShow(a.length+' question(s) added.')}catch(e){qbShow('Could not read that text. Check the format.')}};
$('qbOne').onclick=()=>{const g=id=>$(id).value.trim(),ans=$('mcor').value,o=[g('mA'),g('mB'),g('mC'),g('mD')];
  if(!g('mq')||!o[0]||!o[1]||!o['ABCD'.indexOf(ans)]){qbShow('Enter the question, at least options A and B, and a correct option that is filled in.');return}
  QB.push({q:g('mq'),a:o[0],b:o[1],c:o[2],d:o[3],ans});['mq','mA','mB','mC','mD'].forEach(i=>$(i).value='');qbShow('Question added.')};
$('qbClear').onclick=()=>{QB=[];qbShow('Cleared.')};
$('qbSave').onclick=async()=>{const n=$('qbName').value.trim();if(!n||!QB.length){qbShow('Enter a quiz name and add at least one question.');return}
  const js=JSON.stringify(QB);if(js.length>220000){qbShow('Too many questions for one quiz. Split it into smaller quizzes (about 300 each).');return}
  const id=Date.now().toString(36);
  if(DB){try{await DB.doc('quizzes/'+id).set({name:n,q:js,ts:Date.now()})}catch(e){qbShow('Could not save the quiz. Check that you have Editor access.');return}}
  else{const l=ls.get('pq:quizzes',[]);l.push({id,name:n,q:QB});ls.set('pq:quizzes',l)}
  QB=[];$('qbName').value='';await loadCustom();qbShow('Quiz saved. Tick it for students in the table above.');loadAdmin()};
$('qbExisting').onclick=async e=>{const b=e.target.closest('button');if(!b)return;
  if(!b.dataset.show&&!b.dataset.sure){b.dataset.sure='1';b.textContent='Sure? Click again';return}
  if(b.dataset.cq){const id=b.dataset.cq;if(DB)try{await DB.doc('quizzes/'+id).delete()}catch(er){}else ls.set('pq:quizzes',ls.get('pq:quizzes',[]).filter(x=>x.id!==id));await loadCustom()}
  else if(b.dataset.hide){HIDDEN=[...HIDDEN,b.dataset.hide];await saveHidden()}
  else if(b.dataset.show){HIDDEN=HIDDEN.filter(x=>x!==b.dataset.show);await saveHidden()}
  loadAdmin()};
function qbList(){
  $('qbExisting').innerHTML=MODS.map(m=>{const h=HIDDEN.includes(m.id);
    const btn=m.custom?'<button class="btn ghost" data-cq="'+m.cid+'">Delete</button>':h?'<button class="btn ghost" data-show="'+m.id+'">Restore</button>':'<button class="btn ghost" data-hide="'+m.id+'">Remove</button>';
    return '<div class="row" style="justify-content:space-between;margin-top:8px;'+(h?'opacity:.5':'')+'"><span>'+esc(m.name)+(h?' <span class="tag">removed</span>':'')+'</span>'+btn+'</div>'}).join('')}

$('admBack').onclick=()=>home();
init();

if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register('sw.js').catch(function(){});

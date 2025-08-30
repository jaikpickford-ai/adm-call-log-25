let startTime=null,timerInterval=null,editing=null,currentComment='';
const timerEl=document.getElementById('timer');
const toggleBtn=document.getElementById('toggleBtn');
const histEl=document.getElementById('history');
const exportBtn=document.getElementById('export');
const backupBtn=document.getElementById('backup');
const restoreBtn=document.getElementById('restoreBtn');
const restoreFile=document.getElementById('restoreFile');
const dlg=document.getElementById('editDialog');
const sd=document.getElementById('sd'), st=document.getElementById('st'), ed=document.getElementById('ed'), et=document.getElementById('et'), cm=document.getElementById('cm');
const durPreview=document.getElementById('durPreview');
const commentBtn=document.getElementById('commentBtn');
const commentDlg=document.getElementById('commentDialog');
const liveComment=document.getElementById('liveComment');
const commentPreview=document.getElementById('commentPreview');

const load=()=>JSON.parse(localStorage.getItem('calls')||'[]');
const save=(d)=>localStorage.setItem('calls',JSON.stringify(d));
const pad=n=>String(n).padStart(2,'0');
const fmt=(ms)=>{const s=Math.floor(ms/1000);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return `${pad(h)}:${pad(m)}:${pad(sec)}`;};
const fromInputs=(d,t)=>new Date(`${d}T${t}:00`).getTime();

function render(){
  histEl.innerHTML='';
  const arr=load().slice().sort((a,b)=>b.start-a.start);
  arr.forEach(c=>{
    const li=document.createElement('li'); li.className='item'; li.dataset.id=c.id;
    const meta=document.createElement('div'); meta.className='meta';
    const endTs = c.end ? c.end : (c.len ? c.start + c.len : c.start);
    const dur=fmt((c.len!=null)?c.len:(endTs-c.start));
    meta.innerHTML=`${new Date(c.start).toLocaleDateString()} • ${new Date(c.start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} <span class="badge">${dur}</span><span class="comment">— ${(c.comment||'')}</span>`;
    li.appendChild(meta);
    li.addEventListener('click', ()=>openEdit(c.id));
    histEl.appendChild(li);
  });
  commentPreview.textContent = currentComment ? `Current comment: ${currentComment}` : '';
}

function tick(){ if(!startTime){timerEl.textContent='00:00:00';return;} timerEl.textContent=fmt(Date.now()-startTime); }

function setStateRunning(running){
  if(running){
    toggleBtn.textContent='STOP';
    toggleBtn.classList.remove('startState');
    toggleBtn.classList.add('stopState');
  } else {
    toggleBtn.textContent='START';
    toggleBtn.classList.remove('stopState');
    toggleBtn.classList.add('startState');
  }
}

toggleBtn.onclick=()=>{
  if(!startTime){
    // start
    startTime=Date.now();
    setStateRunning(true);
    timerInterval=setInterval(tick,1000);
    tick();
  } else {
    // stop
    clearInterval(timerInterval);
    const len=Date.now()-startTime;
    let comment=currentComment;
    if(!comment){
      const c=prompt('Comment (max 40 chars):','')||'';
      comment=c.slice(0,40);
    }
    const all=load();
    all.push({id:crypto.randomUUID(),start:startTime,len,comment});
    save(all);
    // reset
    startTime=null; currentComment=''; render();
    timerEl.textContent='00:00:00'; setStateRunning(false);
  }
};

commentBtn.onclick=()=>{ liveComment.value=currentComment || ''; commentDlg.showModal(); };
commentDlg.addEventListener('close',()=>{
  if(commentDlg.returnValue!=='save') return;
  currentComment = (liveComment.value||'').slice(0,40);
  render();
});

function updateDurPreview(){
  if(sd.value && st.value && ed.value && et.value){
    const s=fromInputs(sd.value, st.value), e=fromInputs(ed.value, et.value);
    durPreview.textContent='Duration: '+fmt(Math.max(0,e-s));
  }
}
['sd','st','ed','et'].forEach(id=>document.getElementById(id).addEventListener('input', updateDurPreview));

function openEdit(id){
  const all=load(); const e=all.find(x=>x.id===id); if(!e) return;
  editing=id;
  const s=new Date(e.start); const end = e.len? new Date(e.start + e.len) : (e.end? new Date(e.end) : new Date(e.start));
  sd.value=s.toISOString().slice(0,10);
  st.value=s.toTimeString().slice(0,5);
  ed.value=end.toISOString().slice(0,10);
  et.value=end.toTimeString().slice(0,5);
  cm.value=(e.comment||'').slice(0,40);
  updateDurPreview();
  dlg.showModal();
}

dlg.addEventListener('close', ()=>{
  const choice=dlg.returnValue;
  if(!editing) return;
  const all=load(); const idx=all.findIndex(x=>x.id===editing); if(idx<0) return;
  if(choice==='delete'){
    all.splice(idx,1); save(all); render(); editing=null; return;
  }
  if(choice==='save'){
    const s=fromInputs(sd.value, st.value);
    const e=fromInputs(ed.value, et.value);
    all[idx].start=s;
    all[idx].len=Math.max(0, e - s);
    all[idx].comment=(cm.value||'').slice(0,40);
    save(all); render(); editing=null; return;
  }
  editing=null;
});

// Export CSV
exportBtn.onclick=()=>{
  const data=load().slice().sort((a,b)=>a.start-b.start);
  let csv='Start Date,Start Time,End Date,End Time,Duration,Comment\n';
  data.forEach(c=>{
    const s=new Date(c.start), e=new Date(c.start+(c.len||0));
    csv+=`${s.toISOString().slice(0,10)},${s.toTimeString().slice(0,8)},${e.toISOString().slice(0,10)},${e.toTimeString().slice(0,8)},${fmt(c.len||0)},${(c.comment||'').replace(/"/g,'""')}\n`;
  });
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='callouts.csv'; a.click(); URL.revokeObjectURL(url);
};

// Backup JSON
backupBtn.onclick=()=>{
  const data=load();
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='callouts-backup.json'; a.click(); URL.revokeObjectURL(url);
};
// Restore JSON
restoreBtn.onclick=()=>restoreFile.click();
restoreFile.addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{ const arr=JSON.parse(reader.result||'[]'); if(Array.isArray(arr)){ save(arr); render(); alert('Restore complete'); } else { alert('Invalid backup'); } }
    catch{ alert('Invalid backup file'); }
  };
  reader.readAsText(f);
});

// Init
render();
setStateRunning(false);

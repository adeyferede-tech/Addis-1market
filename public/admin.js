const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const api=async(u,m='GET',b)=>{const r=await fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401&&!u.includes('login'))showLogin();throw new Error(d.error||'Error')}return d};
const SF=[['shopName','Shop name'],['tagline','Tagline'],['about','About us','t'],['phone','Phone'],['email','Email'],['address','Address'],['hours','Opening hours'],['lat','GPS latitude (e.g. 9.0108)'],['lng','GPS longitude (e.g. 38.7613)'],['telebirr','Telebirr number'],['cbe','CBE account number'],['whatsapp','WhatsApp number (251911...)'],['telegram','Telegram link (https://t.me/...)'],['facebook','Facebook link (https://...)'],['instagram','Instagram link (https://...)'],['tiktok','TikTok link (https://...)']];
let PR=[],editId=null;
const showLogin=()=>{$('#login').classList.remove('hide');$('#app').classList.add('hide');$('#logout').classList.add('hide')};
async function enter(){$('#login').classList.add('hide');$('#app').classList.remove('hide');$('#logout').classList.remove('hide');
  $('#sf').innerHTML=SF.map(([k,l,t])=>`<div class="${t?'w':''}"><label class="l">${l}</label>${t?`<textarea id="s_${k}" rows="3"></textarea>`:`<input id="s_${k}">`}</div>`).join('');
  await Promise.all([loadP(),loadO(),loadS()])}
async function loadP(){PR=await api('/api/admin/products');$('#plist').innerHTML=PR.map(p=>`<tr><td>${p.image?`<img class="thumb" src="${esc(p.image)}" alt="">`:esc(p.emoji)}</td><td>${esc(p.name)}<br><small>${esc(p.cat)}</small></td><td>${p.price} ETB</td><td>${p.stock==null?'∞':p.stock}</td><td>${p.active===false?'No':'Yes'}</td><td><button class="btn o" data-e="${p.id}">Edit</button> <button class="btn d" data-d="${p.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="6">No products yet.</td></tr>'}
async function loadO(){const o=await api('/api/admin/orders');$('#to').innerHTML=o.map(x=>`<div class="ord"><b>${esc(x.id)}</b>  ${esc(new Date(x.at).toLocaleString())}  <span class="st">[${esc(x.status)}]</span>\n${esc(x.list)}\nTotal: ${x.total} ETB | ${esc(x.payment)}${x.ref?' ref '+esc(x.ref):''}\n${esc(x.name)} | ${esc(x.phone)}\n${esc(x.address)}${x.gps?`\n<a href="${esc(x.gps)}" target="_blank" rel="noopener">📍 Open GPS location</a>`:''}\n<button class="btn s" data-o="${esc(x.id)}|paid">Paid</button> <button class="btn s" data-o="${esc(x.id)}|done">Done</button> <button class="btn d" data-o="${esc(x.id)}|cancelled">Cancel</button></div>`).join('')||'<p>No orders yet.</p>'}
async function loadS(){const s=await api('/api/admin/settings');SF.forEach(([k])=>$('#s_'+k).value=s[k]||'')}
const fld=['name','cat','price','stock','emoji','image'];
const reset=()=>{editId=null;fld.forEach(k=>$('#f_'+k).value='');$('#f_desc').value='';$('#f_active').checked=true;$('#psave').textContent='Add product';$('#pcancel').classList.add('hide')};
document.addEventListener('click',async e=>{const t=e.target.closest('button');if(!t)return;const d=t.dataset;
 try{
  if(t.id==='go'){await api('/api/admin/login','POST',{password:$('#pw').value});$('#pw').value='';await enter()}
  if(t.id==='logout'){await api('/api/admin/logout','POST');showLogin()}
  if(d.t){['tp','to','ts'].forEach(i=>$('#'+i).classList.toggle('hide',i!==d.t));document.querySelectorAll('[data-t]').forEach(c=>c.classList.toggle('on',c===t));if(d.t==='to')loadO()}
  if(t.id==='psave'){$('#perr').textContent='';const b={active:$('#f_active').checked,description:$('#f_desc').value};fld.forEach(k=>b[k]=$('#f_'+k).value);
    await api(editId?'/api/admin/products/'+editId:'/api/admin/products',editId?'PUT':'POST',b);reset();await loadP()}
  if(t.id==='pcancel')reset();
  if(d.e){const p=PR.find(x=>x.id==d.e);editId=p.id;fld.forEach(k=>$('#f_'+k).value=p[k]??'');$('#f_desc').value=p.description||'';$('#f_active').checked=p.active!==false;$('#psave').textContent='Save changes';$('#pcancel').classList.remove('hide');scrollTo(0,0)}
  if(d.d&&confirm('Delete this product?')){await api('/api/admin/products/'+d.d,'DELETE');await loadP()}
  if(d.o){const[id,status]=d.o.split('|');await api(`/api/admin/orders/${encodeURIComponent(id)}/status`,'POST',{status});await loadO()}
  if(t.id==='ssave'){const b={};SF.forEach(([k])=>b[k]=$('#s_'+k).value);await api('/api/admin/settings','PUT',b);$('#sok').textContent='Saved ✓';setTimeout(()=>$('#sok').textContent='',2500)}
 }catch(x){const el=t.id==='go'?$('#lerr'):$('#perr');el.textContent=x.message}
});
$('#pw').addEventListener('keydown',e=>{if(e.key==='Enter')$('#go').click()});
api('/api/admin/products').then(enter).catch(showLogin);

document.addEventListener('change',async e=>{if(e.target.id!=='f_file'||!e.target.files[0])return;const st=$('#perr');st.textContent='Uploading...';
 try{const img=await createImageBitmap(e.target.files[0]),k=Math.min(1,900/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 const d=await api('/api/admin/upload','POST',{data:c.toDataURL('image/jpeg',.82)});$('#f_image').value=d.url;st.textContent='Photo uploaded. Now click Add product / Save changes.'}catch(x){st.textContent=x.message}e.target.value=''});

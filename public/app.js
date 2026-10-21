const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
let P=[],S={},cat='All',gps=null,step='cart',cart={};
try{cart=JSON.parse(localStorage.getItem('cart')||'{}')}catch{}
const fmt=n=>Number(n).toLocaleString()+' ETB';
const sum=()=>Object.entries(cart).reduce((a,[id,q])=>{const p=P.find(x=>x.id==id);return a+(p?p.price*q:0)},0);
const save=()=>{try{localStorage.setItem('cart',JSON.stringify(cart))}catch{}render()};
const A=(u,l,c='o')=>`<a class="btn ${c}" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`;

let page=1,sort='featured';const PER=12,inS=p=>p.stock==null||p.stock>0,pic=p=>p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:`<span class="em">${esc(p.emoji)}</span>`,price=p=>`${p.old_price>p.price?`<s>${fmt(p.old_price)}</s> `:''}${fmt(p.price)}`;
async function init(){
  [S,P]=await Promise.all([fetch('/api/settings').then(r=>r.json()).catch(()=>({})),fetch('/api/products').then(r=>r.json()).catch(()=>[])]);
  for(const id in cart)if(!P.find(p=>p.id==id))delete cart[id];
  const nm=S.shopName||'Our Shop';document.title=nm;$('#brand').textContent=nm;$('#hTag').textContent=S.tagline||'';
  if(S.announcement){$('#ann').textContent=S.announcement;$('#ann').classList.remove('hide')}
  $('#foot').textContent='© '+new Date().getFullYear()+' '+nm;$('#fname').textContent=nm;$('#fabout').textContent=S.about||'';$('#fcall').textContent=S.phone?'Call us: '+S.phone:'';
  $('#ddm').innerHTML=[...new Set(P.map(p=>p.cat))].map(c=>`<button data-c="${esc(c)}">${esc(c)}</button>`).join('');
  let v='';if(S.about)v+=`<p>${esc(S.about)}</p>`;
  if(S.address)v+=`<p><b>Address:</b> ${esc(S.address)}</p>`;if(S.hours)v+=`<p><b>Hours:</b> ${esc(S.hours)}</p>`;
  if(S.phone)v+=`<p><b>Phone:</b> <a href="tel:${esc(S.phone.replace(/[^\d+]/g,''))}">${esc(S.phone)}</a></p>`;
  if(S.email)v+=`<p><b>Email:</b> <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>`;
  const wa=(S.whatsapp||'').replace(/\D/g,''),soc=[['Telegram',S.telegram],['Facebook',S.facebook],['Instagram',S.instagram],['TikTok',S.tiktok],['WhatsApp',wa&&'https://wa.me/'+wa]].filter(x=>x[1]);
  $('#fsoc').innerHTML=soc.map(([l,u])=>A(u,l,'o')).join('');if(soc.length)v+=`<div class="soc">${soc.map(([l,u])=>A(u,l,'s')).join('')}</div>`;
  $('#vinfo').innerHTML=v;
  const la=parseFloat(S.lat),lo=parseFloat(S.lng);
  if(isFinite(la)&&isFinite(lo))$('#vmap').innerHTML=`<iframe title="Map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${lo-.01},${la-.006},${lo+.01},${la+.006}&layer=mapnik&marker=${la},${lo}"></iframe><p>${A(`https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`,'Get directions','')}</p>`;
  else $('#visit').classList.add('hide');
  render();
}
function view(){
  const t=$('#q').value.toLowerCase(),mn=parseFloat($('#pmin').value),mx=parseFloat($('#pmax').value),ai=$('#av_in').checked,ao=$('#av_out').checked;
  const f={featured:(x,y)=>x.id-y.id,new:(x,y)=>y.id-x.id,old:(x,y)=>x.id-y.id,az:(x,y)=>x.name.localeCompare(y.name),za:(x,y)=>y.name.localeCompare(x.name),lh:(x,y)=>x.price-y.price,hl:(x,y)=>y.price-x.price}[sort];
  return P.filter(p=>(cat==='All'||p.cat===cat)&&p.name.toLowerCase().includes(t)&&(isNaN(mn)||p.price>=mn)&&(isNaN(mx)||p.price<=mx)&&(ai===ao||(ai?inS(p):!inS(p)))).sort(f);
}
function render(){
  const a=view(),pages=Math.max(1,Math.ceil(a.length/PER));if(page>pages)page=1;
  $('#catlist').innerHTML=[['All',P.length],...[...new Set(P.map(p=>p.cat))].map(c=>[c,P.filter(p=>p.cat===c).length])].map(([c,n])=>`<button class="cat ${c===cat?'on':''}" data-c="${esc(c)}">${esc(c==='All'?'All products':c)} <span>(${n})</span></button>`).join('');
  $('#n_in').textContent=P.filter(inS).length;$('#n_out').textContent=P.filter(p=>!inS(p)).length;
  const title=sort==='new'&&cat==='All'?'New Arrivals':cat==='All'?'All Products':cat;
  $('#ctitle').textContent=title;$('#crumb').textContent=title;$('#pginfo').textContent=`Page ${page} of ${pages}`;
  $('#grid').innerHTML=a.slice((page-1)*PER,page*PER).map(p=>{const out=!inS(p);
    return `<div class="pc"><div class="pimg" data-qv="${p.id}">${pic(p)}${out?'<b class="bd so">Sold out</b>':p.old_price>p.price?'<b class="bd">Sale</b>':''}<button class="qs" data-qv="${p.id}">Quick Shop</button></div><a class="pt" data-qv="${p.id}">${esc(p.name)}</a><div class="pp">${price(p)}</div></div>`}).join('')||'<p>No products match your filters.</p>';
  $('#pager').innerHTML=pages>1?(page>1?`<button data-pg="${page-1}">« Prev</button>`:'')+Array.from({length:pages},(_,i)=>`<button class="${i+1===page?'on':''}" data-pg="${i+1}">${i+1}</button>`).join('')+(page<pages?`<button data-pg="${page+1}">Next »</button>`:''):'';
  $('#cnt').textContent=Object.values(cart).reduce((a,b)=>a+b,0);
  if(step==='cart')drawCart();
}
function openQV(id){const p=P.find(x=>x.id==id);if(!p)return;const out=!inS(p);
  $('#qvb').innerHTML=`<div class="qvimg">${pic(p)}</div><div class="qvi"><small>${esc(p.cat)}</small><h2>${esc(p.name)}</h2><div class="pp">${price(p)}</div>${p.description?`<p>${esc(p.description)}</p>`:''}${p.stock!=null&&p.stock>0&&p.stock<=5?`<div class="tag">Only ${p.stock} left</div>`:''}<button class="btn s go" data-a="${p.id}" ${out?'disabled':''}>${out?'Sold out':'Add to cart'}</button></div>`;
  $('#qv').classList.add('on')}
const closeQV=()=>$('#qv').classList.remove('on');
function drawCart(){
  $('#ptitle').textContent='Your cart';const ids=Object.keys(cart);
  $('#pb').innerHTML=ids.length?ids.map(id=>{const p=P.find(x=>x.id==id);return `<div class="row"><span>${esc(p.emoji)}</span><span class="n">${esc(p.name)}<br><small>${fmt(p.price)}</small></span><span class="q"><button data-m="${id}">−</button> ${cart[id]} <button data-p="${id}">+</button></span></div>`}).join(''):'<p>Your cart is empty.</p>';
  $('#pf').innerHTML=`<div class="tot"><span>Total</span><span>${fmt(sum())}</span></div><button class="btn s go" id="toCheckout" ${ids.length?'':'disabled'}>Checkout</button>`;
}
function drawCheckout(){
  step='checkout';$('#ptitle').textContent='Checkout';
  $('#pb').innerHTML=`<label class="l">Full name</label><input id="f_name"><label class="l">Phone</label><input id="f_phone" type="tel" placeholder="09...">
  <label class="l">Email (optional)</label><input id="f_email" type="email"><label class="l">Delivery address</label><textarea id="f_addr" rows="2"></textarea>
  <button class="btn o" id="gpsb" style="margin-top:8px">📍 Share my GPS location</button>
  <label class="l">Payment method</label><div class="pay">
  <label><input type="radio" name="pay" value="cod" checked> Cash on delivery</label>
  <label><input type="radio" name="pay" value="telebirr"> Telebirr transfer</label>
  <label><input type="radio" name="pay" value="cbe"> CBE / bank transfer</label>
  <label><input type="radio" name="pay" value="chapa"> Pay online (Chapa: card, Telebirr, CBE)</label></div>
  <div class="note hide" id="manual"></div><div class="err" id="err"></div>`;
  $('#pf').innerHTML=`<div class="tot"><span>Total</span><span>${fmt(sum())}</span></div><button class="btn s go" id="place">Place order</button><button class="btn o go" style="margin-top:8px" id="back">Back to cart</button>`;
}
async function place(){
  const v=id=>$('#'+id).value.trim(),pay=document.querySelector('[name=pay]:checked').value,ref=$('#f_ref');
  if(!v('f_name')||!v('f_phone')||!v('f_addr'))return $('#err').textContent='Enter your name, phone and address.';
  if((pay==='telebirr'||pay==='cbe')&&!(ref&&ref.value.trim()))return $('#err').textContent='Enter the transaction reference.';
  const b=$('#place');b.disabled=true;b.textContent='Placing order...';
  try{
    const r=await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:v('f_name'),phone:v('f_phone'),email:v('f_email'),address:v('f_addr'),payment:pay,ref:ref?ref.value.trim():'',gps,items:Object.entries(cart).map(([id,qty])=>({id:+id,qty}))})});
    const d=await r.json();if(!r.ok)throw new Error(d.error);
    cart={};save();if(d.checkout_url)return location.href=d.checkout_url;
    $('#ptitle').textContent='Order placed';$('#pb').innerHTML=`<div class="ok"><div style="font-size:56px">✅</div><h2>Thank you!</h2><p>Order <b>${esc(d.id)}</b> for ${fmt(d.total)} is confirmed. We will contact you shortly.</p></div>`;
    $('#pf').innerHTML='<button class="btn s go" id="done">Continue shopping</button>';
  }catch(e){$('#err').textContent=e.message;b.disabled=false;b.textContent='Place order'}
}
const open=()=>{$('#panel').classList.add('open');$('#shade').classList.add('on')};
const closeP=()=>{$('#panel').classList.remove('open');$('#shade').classList.remove('on');step='cart';drawCart()};
document.addEventListener('click',e=>{const t=e.target.closest('button,a,[data-qv]')||e.target,d=t.dataset||{};
  if(d.c!==undefined){cat=d.c;page=1;$('#nav').classList.remove('open');render()}
  if(d.s){sort=d.s;$('#sort').value=d.s;page=1;render();$('#shop').scrollIntoView()}
  if(d.qv)openQV(d.qv);if(t.id==='qv'||d.qx)closeQV();
  if(d.pg){page=+d.pg;render();$('#shop').scrollIntoView()}if(t.id==='pgo')rr();
  if(d.a){cart[d.a]=(cart[d.a]||0)+1;save();closeQV();open()}
  if(d.p){cart[d.p]++;save()}
  if(d.m){if(--cart[d.m]<=0)delete cart[d.m];save()}
  if(t.id==='openCart')open();if(t.id==='close'||t.id==='shade'||t.id==='done')closeP();
  if(t.id==='toCheckout')drawCheckout();if(t.id==='back'){step='cart';drawCart()}if(t.id==='place')place();
  if(t.id==='gpsb')navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{gps={lat:p.coords.latitude,lng:p.coords.longitude};t.textContent='📍 Location added ✓'},()=>{t.textContent='📍 Location blocked, type your address'}):0;
});
document.addEventListener('change',e=>{if(e.target.name!=='pay')return;const x=e.target.value,m=$('#manual');
  if(x==='telebirr'||x==='cbe'){const to=x==='telebirr'?S.telebirr:S.cbe;m.classList.remove('hide');m.innerHTML=`Send <b>${fmt(sum())}</b> to <b>${esc(to||'(ask the shop)')}</b>, then enter the reference:<br><input id="f_ref" placeholder="Transaction reference" style="margin-top:8px">`}else m.classList.add('hide')});
const rr=()=>{page=1;render()};
$('#q').addEventListener('input',rr);$('#sort').addEventListener('change',e=>{sort=e.target.value;rr()});
['#av_in','#av_out'].forEach(s=>$(s).addEventListener('change',rr));
$('#burger').addEventListener('click',()=>$('#nav').classList.toggle('open'));$('#ftog').addEventListener('click',()=>$('#side').classList.toggle('open'));
init();

// ---- Image viewer: size is computed from the real photo ratio, so it can never stretch ----
(()=>{
  const lb=document.createElement('div');lb.id='lb';lb.className='hide';
  lb.innerHTML='<div class="lbt"><span id="lbn"></span><span><button data-z="-">−</button><button data-z="0">Reset</button><button data-z="+">+</button><button data-z="x">✕</button></span></div><div class="lbs"><img id="lbi" alt=""></div><div class="lbh">Scroll, pinch or use + / − to zoom. Drag to move. Double-tap to zoom.</div>';
  document.body.appendChild(lb);
  const im=lb.querySelector('#lbi'),st=lb.querySelector('.lbs'),pts=new Map();
  let k=1,x=0,y=0,d0=1,k0=1,bw=0,bh=0;
  const fit=()=>{const nw=im.naturalWidth||1,nh=im.naturalHeight||1,r=Math.min(st.clientWidth*.96/nw,st.clientHeight*.96/nh);bw=nw*r;bh=nh*r};
  const apply=()=>{im.style.width=bw*k+'px';im.style.height=bh*k+'px';im.style.transform=`translate(calc(-50% + ${x}px),calc(-50% + ${y}px))`};
  const zoom=f=>{k=Math.min(6,Math.max(.25,k*f));if(k<=1)x=y=0;apply()};
  const reset=()=>{k=1;x=y=0;fit();apply()};
  const close=()=>{lb.classList.add('hide');document.body.style.overflow='';pts.clear()};
  const dist=()=>{const[a,b]=[...pts.values()];return Math.hypot(a.x-b.x,a.y-b.y)||1};
  document.addEventListener('click',e=>{const i=e.target.closest('.qvimg img');if(!i)return;
    lb.querySelector('#lbn').textContent=i.alt||'';lb.classList.remove('hide');document.body.style.overflow='hidden';
    im.onload=reset;im.src=i.src;if(im.complete&&im.naturalWidth)reset()});
  lb.addEventListener('click',e=>{const z=e.target.dataset&&e.target.dataset.z;
    if(z==='+')zoom(1.4);if(z==='-')zoom(1/1.4);if(z==='0')reset();if(z==='x')close()});
  st.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15)},{passive:false});
  st.addEventListener('dblclick',()=>{k>1?reset():(k=2,apply())});
  st.addEventListener('pointerdown',e=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===2){d0=dist();k0=k}});
  st.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;
    const n={x:e.clientX,y:e.clientY};
    if(pts.size===2){pts.set(e.pointerId,n);k=Math.min(6,Math.max(.25,k0*dist()/d0));apply();return}
    if(k>1){x+=n.x-p.x;y+=n.y-p.y;apply()}pts.set(e.pointerId,n)});
  ['pointerup','pointercancel','pointerleave'].forEach(t=>st.addEventListener(t,e=>pts.delete(e.pointerId)));
  window.addEventListener('resize',()=>{if(!lb.classList.contains('hide')){fit();apply()}});
  document.addEventListener('keydown',e=>{if(lb.classList.contains('hide'))return;
    if(e.key==='Escape')close();if(e.key==='+'||e.key==='=')zoom(1.4);if(e.key==='-')zoom(1/1.4)});
})();

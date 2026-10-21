const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
let P=[],S={},cat='All',gps=null,step='cart',cart={};
try{cart=JSON.parse(localStorage.getItem('cart')||'{}')}catch{}
const fmt=n=>Number(n).toLocaleString()+' ETB';
const sum=()=>Object.entries(cart).reduce((a,[id,q])=>{const p=P.find(x=>x.id==id);return a+(p?p.price*q:0)},0);
const save=()=>{try{localStorage.setItem('cart',JSON.stringify(cart))}catch{}render()};
const A=(u,l,c='o')=>`<a class="btn ${c}" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`;

async function init(){
  [S,P]=await Promise.all([fetch('/api/settings').then(r=>r.json()).catch(()=>({})),fetch('/api/products').then(r=>r.json()).catch(()=>[])]);
  for(const id in cart)if(!P.find(p=>p.id==id))delete cart[id];
  const nm=S.shopName||'Our Shop';document.title=nm;$('#brand').textContent=nm;$('#hName').textContent=nm;$('#hTag').textContent=S.tagline||'';
  $('#foot').textContent='© '+new Date().getFullYear()+' '+nm;
  let v='';if(S.about)v+=`<p>${esc(S.about)}</p>`;
  if(S.address)v+=`<p><b>Address:</b> ${esc(S.address)}</p>`;if(S.hours)v+=`<p><b>Hours:</b> ${esc(S.hours)}</p>`;
  if(S.phone)v+=`<p><b>Phone:</b> <a href="tel:${esc(S.phone.replace(/[^\d+]/g,''))}">${esc(S.phone)}</a></p>`;
  if(S.email)v+=`<p><b>Email:</b> <a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>`;
  const wa=(S.whatsapp||'').replace(/\D/g,''),soc=[['Telegram',S.telegram],['Facebook',S.facebook],['Instagram',S.instagram],['TikTok',S.tiktok],['WhatsApp',wa&&'https://wa.me/'+wa]].filter(x=>x[1]);
  if(soc.length)v+=`<div class="soc">${soc.map(([l,u])=>A(u,l,'s')).join('')}</div>`;
  $('#vinfo').innerHTML=v;
  const la=parseFloat(S.lat),lo=parseFloat(S.lng);
  if(isFinite(la)&&isFinite(lo)){
    $('#vmap').innerHTML=`<iframe title="Map" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${lo-.01},${la-.006},${lo+.01},${la+.006}&layer=mapnik&marker=${la},${lo}"></iframe><p>${A(`https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`,'Get directions','')}</p>`;
  }else $('#visit').classList.add('hide');
  render();
}
function render(){
  const cats=['All',...new Set(P.map(p=>p.cat))],t=$('#q').value.toLowerCase();
  $('#cats').innerHTML=cats.map(c=>`<button class="chip ${c===cat?'on':''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  $('#grid').innerHTML=P.filter(p=>(cat==='All'||p.cat===cat)&&p.name.toLowerCase().includes(t)).map(p=>{
    const out=p.stock!=null&&p.stock<=0;
    return `<div class="card"><div class="pic">${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:esc(p.emoji)}</div><div class="capbox"><small>${esc(p.cat)}</small><h3>${esc(p.name)}</h3>${p.description?`<p>${esc(p.description)}</p>`:''}<div class="price">${fmt(p.price)}</div>${out?'<div class="tag">Sold out</div>':p.stock!=null&&p.stock<=5?`<div class="tag">Only ${p.stock} left</div>`:''}</div><div class="buy"><button class="btn s" data-a="${p.id}" ${out?'disabled':''}>${out?'Sold out':'Add to cart'}</button></div></div>`}).join('')||'<p>No products found.</p>';
  $('#cnt').textContent=Object.values(cart).reduce((a,b)=>a+b,0);
  if(step==='cart')drawCart();
}
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
document.addEventListener('click',e=>{const t=e.target.closest('button,a')||e.target,d=t.dataset||{};
  if(d.c){cat=d.c;render()}
  if(d.a){cart[d.a]=(cart[d.a]||0)+1;save();open()}
  if(d.p){cart[d.p]++;save()}
  if(d.m){if(--cart[d.m]<=0)delete cart[d.m];save()}
  if(t.id==='openCart')open();if(t.id==='close'||t.id==='shade'||t.id==='done')closeP();
  if(t.id==='toCheckout')drawCheckout();if(t.id==='back'){step='cart';drawCart()}if(t.id==='place')place();
  if(t.id==='gpsb')navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{gps={lat:p.coords.latitude,lng:p.coords.longitude};t.textContent='📍 Location added ✓'},()=>{t.textContent='📍 Location blocked, type your address'}):0;
});
document.addEventListener('change',e=>{if(e.target.name!=='pay')return;const x=e.target.value,m=$('#manual');
  if(x==='telebirr'||x==='cbe'){const to=x==='telebirr'?S.telebirr:S.cbe;m.classList.remove('hide');m.innerHTML=`Send <b>${fmt(sum())}</b> to <b>${esc(to||'(ask the shop)')}</b>, then enter the reference:<br><input id="f_ref" placeholder="Transaction reference" style="margin-top:8px">`}else m.classList.add('hide')});
$('#q').addEventListener('input',render);init();

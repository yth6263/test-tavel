import { firebaseConfig } from './firebase-config.js';

const ADMIN_EMAIL='yth6263@gmail.com';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>Number(value||0).toLocaleString('ko-KR');
const isAdminUser=user=>user?.email?.toLowerCase()===ADMIN_EMAIL;
const loginView=$('#admin-login-view'), dashboard=$('#admin-dashboard'), loginError=$('#login-error');
let auth,db,signInWithEmailAndPassword,signOut,onAuthStateChanged;
let ref,onValue,push,set,update,remove,get;
let currentUser=null,bookings=[],destinations=[],stays=[];
let stopBookings=null,stopDestinations=null,stopStays=null;
let bookingState='loading';

function showLogin(message=''){
  loginView.hidden=false; dashboard.hidden=true;
  loginError.hidden=!message; loginError.textContent=message;
}
function bookingErrorText(error){
  const detail=typeof error==='string'?error:(error?.message||error?.code||(error?String(error):''));
  return detail.trim()||'Firebase에서 오류 상세를 전달하지 않았습니다. Realtime Database 규칙이 게시되었는지 확인하세요.';
}
function setBookingState(state,message=''){
  bookingState=state;
  const box=$('#booking-state');
  box.hidden=state==='ready'&&bookings.length>0;
  box.classList.toggle('error',state==='error');
  if(state==='loading')box.textContent='예약을 불러오는 중입니다…';
  else if(state==='error')box.textContent=`예약 정보를 가져오지 못했습니다. Firebase Console의 Realtime Database → 규칙에 프로젝트의 최신 database.rules.json을 게시했는지 확인하세요.${message?` 상세 오류: ${message}`:''}`;
  else box.textContent=bookings.length?'':'현재 등록된 예약이 없습니다.';
}
function renderBookings(){
  const count=bookingState==='loading'?'…':bookingState==='error'?'!':bookings.length;
  $('#tab-booking-count').textContent=count;
  $('#stat-total').textContent=bookingState==='ready'?bookings.length:count;
  $('#stat-pending').textContent=bookingState==='ready'?bookings.filter(item=>!item.status||item.status==='pending').length:count;
  $('#stat-confirmed').textContent=bookingState==='ready'?bookings.filter(item=>item.status==='confirmed').length:count;
  $('#stat-cancelled').textContent=bookingState==='ready'?bookings.filter(item=>item.status==='cancelled').length:count;
  const sorted=[...bookings].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  $('#booking-list').innerHTML=sorted.map(item=>{
    const stay=stays.find(row=>row.id===item.stayId);
    const name=item.guestName||item.memberName||item.name||'예약자 정보 없음';
    const stayName=item.stayName||item.accommodationName||stay?.name||item.stayId||'숙소 정보 없음';
    const status=item.status||'pending';
    const statusLabel=status==='confirmed'?'예약 확정':status==='cancelled'?'취소됨':'확인 중';
    return `<article class="admin-booking"><div class="admin-booking-title">${safe(name)} · ${safe(stayName)}</div><span class="status ${status==='confirmed'?'confirmed':status==='cancelled'?'cancelled':''}">${statusLabel}</span><div class="admin-booking-meta">${safe(item.checkIn||'날짜 미입력')} → ${safe(item.checkOut||'날짜 미입력')} · ${safe(item.guests||'-')}명 · 접수 ${item.createdAt?new Date(Number(item.createdAt)).toLocaleString('ko-KR'):'시간 정보 없음'}</div><div class="admin-booking-contact">이메일 ${safe(item.email||'-')} · 연락처 ${safe(item.phone||'-')}</div><select aria-label="${safe(name)} 예약 상태" data-booking-status="${safe(item.id)}"><option value="pending" ${status==='pending'?'selected':''}>확인 중</option><option value="confirmed" ${status==='confirmed'?'selected':''}>예약 확정</option><option value="cancelled" ${status==='cancelled'?'selected':''}>취소됨</option></select></article>`;
  }).join('');
  setBookingState(bookingState);
}
function renderDestinations(){
  $('#tab-destination-count').textContent=destinations.length;
  $('#destination-list').innerHTML=destinations.length?destinations.map(item=>`<article class="admin-record"><div><strong>${safe(item.name)}</strong><small>${safe(item.address||'')}</small></div><div class="admin-record-actions"><button type="button" data-edit-destination="${safe(item.id)}">수정</button><button class="delete" type="button" data-delete-destination="${safe(item.id)}">삭제</button></div></article>`).join(''):'<div class="admin-state">등록된 여행지가 없습니다.</div>';
  const select=$('#stay-form [name="destinationId"]');
  select.innerHTML='<option value="">여행지를 선택해 주세요</option>'+destinations.map(item=>`<option value="${safe(item.id)}">${safe(item.name)}</option>`).join('');
}
function renderStays(){
  $('#tab-stay-count').textContent=stays.length;
  $('#stay-list').innerHTML=stays.length?stays.map(item=>`<article class="admin-record"><div><strong>${safe(item.name)} · ${safe(item.roomName||'객실')}</strong><small>${safe(destinations.find(dest=>dest.id===item.destinationId)?.name||'여행지 미지정')} · ${safe(item.address||'')}</small></div><div class="admin-record-actions"><button type="button" data-edit-stay="${safe(item.id)}">수정</button><button class="delete" type="button" data-delete-stay="${safe(item.id)}">삭제</button></div></article>`).join(''):'<div class="admin-state">등록된 숙소가 없습니다.</div>';
}
function objectRecords(snapshot){const data=snapshot.val()||{};return Object.entries(data).filter(([,value])=>value&&typeof value==='object').map(([id,value])=>({id,...value}));}
function startDashboard(user){
  currentUser=user; loginView.hidden=true; dashboard.hidden=false; $('#admin-account').textContent=`${user.email} 관리자 계정`;
  bookings=[];bookingState='loading';renderBookings();
  if(stopBookings)stopBookings();
  stopBookings=onValue(ref(db,'bookings'),snapshot=>{bookings=objectRecords(snapshot);bookingState='ready';renderBookings();},error=>{bookings=[];bookingState='error';renderBookings();setBookingState('error',bookingErrorText(error));console.error('관리자 예약 조회 오류',error);});
  if(stopDestinations)stopDestinations();
  stopDestinations=onValue(ref(db,'destinations'),snapshot=>{destinations=objectRecords(snapshot);renderDestinations();renderStays();},error=>console.error('여행지 조회 오류',error));
  if(stopStays)stopStays();
  stopStays=onValue(ref(db,'stays'),snapshot=>{stays=objectRecords(snapshot);renderStays();renderBookings();},error=>console.error('숙소 조회 오류',error));
}
function normalizeError(error){return ({'auth/invalid-credential':'관리자 이메일과 비밀번호를 확인해 주세요.','auth/configuration-not-found':'Firebase Authentication의 이메일/비밀번호 로그인을 사용 설정해 주세요.','auth/too-many-requests':'로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.'})[error?.code]||error?.message||'요청을 완료하지 못했습니다.';}
function requireAdmin(){if(!firebaseConfig.apiKey||!auth)return showLogin('Firebase 설정을 불러오지 못했습니다.');}

$('#admin-login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget,data=Object.fromEntries(new FormData(form));
  const submit=form.querySelector('button[type="submit"]');submit.disabled=true;loginError.hidden=true;
  try{
    const credential=await signInWithEmailAndPassword(auth,data.email.trim(),data.password);
    if(!isAdminUser(credential.user)){
      await signOut(auth);currentUser=null;
      const message='이 계정은 관리자 계정이 아닙니다.';showLogin(message);window.alert(`관리자 로그인 실패\n${message}`);return;
    }
    startDashboard(credential.user);form.reset();window.alert(`관리자 로그인 성공\n${credential.user.email} 계정으로 인증되었습니다.`);
  }catch(error){const message=normalizeError(error);showLogin(message);window.alert(`관리자 로그인 실패\n${message}`);}
  finally{submit.disabled=false;}
});
$('#admin-logout').addEventListener('click',async()=>{
  const email=currentUser?.email||'관리자';
  try{await signOut(auth);window.alert(`${email} 계정이 로그아웃되었습니다.`);}
  catch(error){window.alert(`로그아웃 실패\n${normalizeError(error)}`);}
});
$('#booking-refresh').addEventListener('click',async()=>{
  if(!currentUser)return;
  setBookingState('loading');
  try{const snapshot=await get(ref(db,'bookings'));bookings=objectRecords(snapshot);bookingState='ready';renderBookings();}
  catch(error){bookingState='error';bookings=[];renderBookings();setBookingState('error',bookingErrorText(error));}
});
$$('.admin-tab').forEach(button=>button.addEventListener('click',()=>{
  $$('.admin-tab').forEach(tab=>tab.classList.toggle('active',tab===button));
  $$('.admin-panel').forEach(panel=>{const active=panel.id===`panel-${button.dataset.tab}`;panel.hidden=!active;panel.classList.toggle('active',active);});
}));
function saveForm(form,path,numericFields=[]){
  const data=Object.fromEntries(new FormData(form));const id=data.id;delete data.id;
  numericFields.forEach(key=>data[key]=Number(data[key]||0));
  const target=id?ref(db,`${path}/${id}`):push(ref(db,path));
  return (id?update(target,data):set(target,data));
}
function fillForm(form,item){Object.entries(item).forEach(([key,value])=>{const input=form.elements.namedItem(key);if(input)input.value=value??'';});form.scrollIntoView({behavior:'smooth',block:'center'});}
$('#destination-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;try{await saveForm(form,'destinations');form.reset();form.elements.namedItem('id').value='';window.alert('여행지 정보를 저장했습니다.');}catch(error){window.alert(`저장 실패\n${normalizeError(error)}`);}});
$('#stay-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;try{await saveForm(form,'stays',['roomCount','capacity','price']);form.reset();form.elements.namedItem('id').value='';window.alert('숙소 정보를 저장했습니다.');}catch(error){window.alert(`저장 실패\n${normalizeError(error)}`);}});
$('#destination-list').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit-destination]'),del=event.target.closest('[data-delete-destination]');
  if(edit){const item=destinations.find(row=>row.id===edit.dataset.editDestination);if(item)fillForm($('#destination-form'),item);}
  if(del&&window.confirm('이 여행지를 삭제할까요?'))try{await remove(ref(db,`destinations/${del.dataset.deleteDestination}`));}catch(error){window.alert(`삭제 실패\n${normalizeError(error)}`);}
});
$('#stay-list').addEventListener('click',async event=>{
  const edit=event.target.closest('[data-edit-stay]'),del=event.target.closest('[data-delete-stay]');
  if(edit){const item=stays.find(row=>row.id===edit.dataset.editStay);if(item)fillForm($('#stay-form'),item);}
  if(del&&window.confirm('이 숙소를 삭제할까요?'))try{await remove(ref(db,`stays/${del.dataset.deleteStay}`));}catch(error){window.alert(`삭제 실패\n${normalizeError(error)}`);}
});
$('#booking-list').addEventListener('change',async event=>{
  const select=event.target.closest('[data-booking-status]');if(!select)return;
  try{await update(ref(db,`bookings/${select.dataset.bookingStatus}`),{status:select.value});}
  catch(error){window.alert(`예약 상태 변경 실패\n${normalizeError(error)}`);}
});

try{
  const [appSdk,authSdk,databaseSdk]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js')
  ]);
  const app=appSdk.initializeApp(firebaseConfig);auth=authSdk.getAuth(app);db=databaseSdk.getDatabase(app);
  ({signInWithEmailAndPassword,signOut,onAuthStateChanged}=authSdk);
  ({ref,onValue,push,set,update,remove,get}=databaseSdk);
  onAuthStateChanged(auth,user=>{
    if(isAdminUser(user))startDashboard(user);
    else{currentUser=null;showLogin(user?'관리자 계정으로 로그인해 주세요.':'');}
  });
}catch(error){showLogin(`Firebase 연결 실패\n${normalizeError(error)}`);console.error(error);}

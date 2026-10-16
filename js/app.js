import { firebaseConfig } from './firebase-config.js';

const PLACEHOLDER = 'YOUR_API_KEY';
const ADMIN_EMAIL = 'yth6263@gmail.com';
const firebaseReady = firebaseConfig.apiKey && firebaseConfig.apiKey !== PLACEHOLDER;
let auth, db, currentUser = null, isAdmin = false, authMode = 'login', selectedStay = null;
let initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut;
let getDatabase, ref, onValue, push, set, query, orderByChild, equalTo;
let stopBookingsListener = null;
let destinations = [], stays = [], bookings = [];
const $ = (s, root = document) => root.querySelector(s);
const isConfiguredAdmin = user => user?.email?.toLowerCase() === ADMIN_EMAIL;
const authPopup = message => window.alert(message);
function loggedInLabel(user) { return user?.displayName ? `${user.displayName} (${user.email})` : (user?.email || '로그인 사용자'); }
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const safe = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const localImage = (name, kind = 'destination') => `https://images.unsplash.com/${name}?auto=format&fit=crop&w=1000&q=82`;
const fallbackDestinations = [
  { id:'sample-jeju', name:'제주도', address:'제주특별자치도', description:'바람과 파도, 느린 하루가 기다리는 섬', image:localImage('photo-1473116763249-2faaef81ccda') },
  { id:'sample-gyeongju', name:'경주', address:'경상북도 경주시', description:'천년의 시간 위에 포개진 고요한 풍경', image:localImage('photo-1517154421773-0529f29ea451') },
  { id:'sample-gangneung', name:'강릉', address:'강원특별자치도 강릉시', description:'푸른 바다와 솔숲 사이, 바다의 아침', image:localImage('photo-1507525428034-b723cf961d3e') }
];
const fallbackStays = [
  { id:'sample-stay-1', name:'바람의 정원', destinationId:'sample-jeju', address:'제주특별자치도 제주시 애월읍', phone:'064-712-0404', roomName:'오션뷰 더블룸', roomCount:4, capacity:2, price:145000, image:localImage('photo-1449158743715-0a90ebb6d2d8') },
  { id:'sample-stay-2', name:'소소재', destinationId:'sample-gyeongju', address:'경상북도 경주시 포석로', phone:'054-741-2288', roomName:'한옥 스테이', roomCount:3, capacity:2, price:118000, image:localImage('photo-1449844908441-8829872d2607') },
  { id:'sample-stay-3', name:'파도소리 스테이', destinationId:'sample-gangneung', address:'강원특별자치도 강릉시', phone:'033-651-0909', roomName:'테라스 트윈룸', roomCount:5, capacity:3, price:132000, image:localImage('photo-1499793983690-e29da59ef1c2') }
];
const toast = message => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 3000); };
const openDialog = id => $(`#${id}`).showModal();
const closeDialog = dialog => dialog.close();
const databaseReady = () => { if (!firebaseReady || !db) { toast('Firebase 설정을 완료하면 데이터가 연결됩니다.'); return false; } return true; };
const records = value => value ? Object.entries(value).map(([id, item]) => ({ id, ...item })) : [];
const money = value => Number(value || 0).toLocaleString('ko-KR');
const destinationFor = id => destinations.find(item => item.id === id);
const imageStyle = url => url ? `background-image:url('${safe(url)}')` : '';

function renderDestinations() {
  const term = $('#destination-search').value.trim().toLowerCase();
  const filtered = destinations.filter(item => !term || `${item.name} ${item.address}`.toLowerCase().includes(term));
  $('#destination-list').innerHTML = filtered.length ? filtered.map(item => `<article class="destination-card" data-destination="${safe(item.id)}"><div class="destination-image" style="${imageStyle(item.image)}"></div><div class="destination-content"><span class="destination-location">${safe(item.address || 'KOREA').toUpperCase()}</span><h3>${safe(item.name)}</h3><p>${safe(item.description || '새로운 풍경과 쉼이 기다리는 여행지')}</p></div><span class="destination-arrow">↗</span></article>`).join('') : '<div class="empty-state">검색 결과가 없어요. 다른 여행지를 입력해 보세요.</div>';
  const options = destinations.map(item => `<option value="${safe(item.id)}">${safe(item.name)}</option>`).join('');
  $('#stay-destination').innerHTML = '<option value="">모든 여행지</option>' + options;
  $('#stay-form [name="destinationId"]').innerHTML = '<option value="">여행지를 선택해 주세요</option>' + options;
  renderStays();
}
function renderStays() {
  const selected = $('#stay-destination').value;
  const list = stays.filter(item => !selected || item.destinationId === selected);
  $('#stay-count').textContent = `숙소 ${list.length}곳`;
  $('#stay-list').innerHTML = list.length ? list.map(item => {
    const destination = destinationFor(item.destinationId);
    return `<article class="stay-card"><div class="stay-image-wrap"><div class="stay-image" style="${imageStyle(item.image || destination?.image)}"></div><span class="stay-tag">${safe(destination?.name || 'ONTRIP STAY')} 근처</span></div><div class="stay-body"><span class="stay-overline">${safe(item.address || destination?.address || '')}</span><h3>${safe(item.name)}</h3><div class="stay-room">${safe(item.roomName || '스탠다드룸')} · 객실 ${safe(item.roomCount || 1)}개</div><div class="stay-meta"><span class="stay-capacity">최대 ${safe(item.capacity)}인</span><span class="stay-price"><strong>${money(item.price)}</strong> <small>원 / 박</small></span></div><div class="stay-footer"><a class="stay-phone" href="tel:${safe((item.phone || '').replace(/[^\d+]/g,''))}">${safe(item.phone || '')}</a><button class="button button-dark" data-book="${safe(item.id)}">예약하기 <span>→</span></button></div></div></article>`;
  }).join('') : '<div class="empty-state">아직 등록된 숙소가 없어요.</div>';
}
function renderMyBookings() {
  const mine = bookings.filter(item => item.userId === currentUser?.uid);
  $('#my-booking-list').innerHTML = mine.length ? mine.map(item => `<div class="booking-entry"><div><strong>${safe(item.stayName || stays.find(s => s.id === item.stayId)?.name || '숙소 예약')}</strong><small>${safe(item.checkIn)} → ${safe(item.checkOut)} · ${safe(item.guests)}인</small></div><span class="status ${item.status === 'confirmed' ? 'confirmed' : item.status === 'cancelled' ? 'cancelled' : ''}">${item.status === 'confirmed' ? '예약 확정' : item.status === 'cancelled' ? '취소됨' : '확인 중'}</span></div>`).join('') : '<div class="empty-state">아직 예약 내역이 없습니다. 마음에 드는 숙소를 찾아보세요.</div>';
}
function subscribeData() {
  if (!firebaseReady || !db) { destinations = fallbackDestinations; stays = fallbackStays; renderDestinations(); return; }
  onValue(ref(db, 'destinations'), snapshot => { const data = records(snapshot.val()); destinations = data.length ? data : fallbackDestinations; renderDestinations(); }, () => toast('여행지 정보를 읽지 못했습니다. Firebase 설정과 규칙을 확인해 주세요.'));
  onValue(ref(db, 'stays'), snapshot => { const data = records(snapshot.val()); stays = data.length ? data : fallbackStays; renderStays(); }, () => toast('숙소 정보를 읽지 못했습니다.'));
}
function subscribeBookings(user) {
  if (stopBookingsListener) stopBookingsListener();
  stopBookingsListener = null;
  bookings = [];
  adminBookingsState='loading'; adminBookingsError='';
  if (!user || !db) { renderMyBookings(); return; }
  const bookingsQuery = query(ref(db, 'bookings'), orderByChild('userId'), equalTo(user.uid));
  stopBookingsListener = onValue(bookingsQuery, snapshot => {
    bookings = records(snapshot.val());
    adminBookingsState='ready'; adminBookingsError='';
    renderMyBookings();
  }, error => {
    bookings = [];
    adminBookingsState='error'; adminBookingsError=error?.message || error?.code || '권한 또는 연결 오류';
    renderMyBookings();
    console.error('예약 목록 조회 실패:', error);
  });
}
function updateAuthUI(user) { currentUser = user; $('#auth-open').hidden = Boolean(user); $('#signup-open').hidden = Boolean(user); $('#logout-button').hidden = !user; const label=isAdmin?'관리자 메뉴':'관리자'; const adminButton=$('#admin-open'), footerAdmin=$('#footer-admin-open'); adminButton.hidden=Boolean(user)&&!isAdmin; footerAdmin.hidden=Boolean(user)&&!isAdmin; adminButton.textContent=label; footerAdmin.textContent=label; adminButton.setAttribute('aria-label',isAdmin?'관리자 메뉴 열기':'관리자 로그인'); }
function setAuthMode(mode) {
  authMode = mode; const signup = mode === 'signup'; $('#auth-title').textContent = signup ? '온트립과 여행을 시작해요' : '다시 만나 반가워요'; $('#auth-description').textContent = signup ? '간단한 회원가입으로 예약을 시작해 보세요.' : '로그인하고 나만의 여행을 시작해 보세요.'; $$('.auth-name, .auth-phone').forEach(el => { el.hidden = !signup; el.querySelector('input').required = signup; }); $('#auth-form [name="password"]').autocomplete = signup ? 'new-password' : 'current-password'; $('#auth-submit').innerHTML = signup ? '회원가입 <span>→</span>' : '로그인 <span>→</span>'; $('#auth-switch').innerHTML = signup ? '이미 회원이신가요? <strong>로그인</strong>' : '아직 회원이 아니신가요? <strong>회원가입</strong>';
}
function requireLogin() { if (!currentUser) { setAuthMode('login'); openDialog('auth-dialog'); toast(firebaseReady ? '예약하려면 로그인해 주세요.' : 'Firebase 설정 후 회원 서비스를 이용할 수 있어요.'); return false; } return true; }
function startBooking(id) {
  if (!requireLogin()) return;
  selectedStay = stays.find(item => item.id === id); if (!selectedStay) return;
  $('#booking-title').textContent = selectedStay.name; $('#booking-subtitle').textContent = `${destinationFor(selectedStay.destinationId)?.name || ''} · ${selectedStay.roomName || '객실'} · 최대 ${selectedStay.capacity}인`;
  const capacity = Math.max(1, Number(selectedStay.capacity || 1)); $('#booking-form [name="guests"]').innerHTML = Array.from({ length: capacity }, (_, i) => `<option value="${i+1}">${i+1}명</option>`).join('');
  const today = new Date(); const toDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; $('#booking-form [name="checkIn"]').min = toDate(today); $('#booking-form [name="checkOut"]').min = toDate(new Date(today.getTime()+86400000)); $('#booking-form [name="checkIn"]').value = ''; $('#booking-form [name="checkOut"]').value = ''; $('#booking-form [name="guestName"]').value = currentUser.displayName || ''; $('#booking-form [name="phone"]').value = '';
  closeDialog($('#auth-dialog')); openDialog('booking-dialog');
}
function showDestinationDetail(id) {
  const destination = destinationFor(id);
  if (!destination) return;
  const nearby = stays.filter(stay => stay.destinationId === id);
  $('#destination-detail').innerHTML = `<div class="detail-image" style="${imageStyle(destination.image)}"></div><div class="detail-content"><span class="eyebrow">DISCOVER THE PLACE</span><h2>${safe(destination.name)}</h2><p class="detail-address">⌖ ${safe(destination.address || '주소 정보가 준비 중입니다.')}</p><p class="detail-description">${safe(destination.description || `${destination.name}에서 새로운 풍경과 쉼을 만나보세요.`)}</p><div class="detail-stays-heading"><h3>주변 숙소</h3><span>${nearby.length}곳</span></div><div class="detail-stay-list">${nearby.length ? nearby.map(stay => `<article class="detail-stay"><div><strong>${safe(stay.name)}</strong><small>${safe(stay.roomName || '객실')} · 최대 ${safe(stay.capacity)}인 · ${money(stay.price)}원 / 박</small></div><button class="button button-dark" data-detail-book="${safe(stay.id)}">예약하기 <span>→</span></button></article>`).join('') : '<div class="empty-state">아직 연결된 숙소가 없습니다. 주변 숙소를 준비 중이에요.</div>'}</div></div>`;
  openDialog('destination-dialog');
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function friendlyError(error) { if (error.code === 'auth/configuration-not-found') return '이 Firebase 프로젝트에서 Authentication이 아직 초기화되지 않았습니다. Firebase Console에서 Authentication을 시작하고 이메일/비밀번호 로그인을 사용 설정해 주세요.'; return ({'auth/email-already-in-use':'이미 가입된 이메일입니다.','auth/invalid-email':'이메일 형식을 확인해 주세요.','auth/weak-password':'비밀번호는 6자 이상으로 입력해 주세요.','auth/invalid-credential':'이메일 또는 비밀번호를 확인해 주세요.','auth/user-not-found':'등록되지 않은 계정입니다.','auth/wrong-password':'비밀번호를 확인해 주세요.','PERMISSION_DENIED':'Firebase 실시간 데이터베이스 규칙에서 접근이 거부되었습니다.'})[error.code || error.message] || error.message || '다시 시도해 주세요.'; }

$('#auth-open').addEventListener('click', () => { setAuthMode('login'); openDialog('auth-dialog'); });
$('#signup-open').addEventListener('click', () => { setAuthMode('signup'); openDialog('auth-dialog'); });
$('#auth-switch').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'signup' : 'login'));
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!firebaseReady || !auth || !db) return authPopup('로그인 실패\nFirebase 연결을 확인해 주세요.');
  const form = event.currentTarget;
  const data = formObject(form);
  const submit = $('#auth-submit');
  submit.disabled = true;
  submit.textContent = authMode === 'signup' ? '회원정보 저장 중…' : '로그인 중…';
  let accountCreated = false;
  try {
    if (authMode === 'signup') {
      let memberUser = auth.currentUser || currentUser;
      if (!memberUser) {
        const credential = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
        memberUser = credential.user;
        accountCreated = true;
      }
      // 비밀번호는 Realtime Database에 저장하지 않고 Firebase Authentication만 사용합니다.
      await set(ref(db, `members/${memberUser.uid}`), {
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: memberUser.email,
        createdAt: Date.now()
      });
    } else {
      await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
    }
    closeDialog($('#auth-dialog'));
    form.reset();
    authPopup(authMode === 'signup' ? '회원가입 성공\n회원가입과 회원정보 저장이 완료됐습니다.' : `로그인 성공\n${data.email.trim()} 계정으로 로그인했습니다.`);
  } catch (error) {
    if (accountCreated) {
      authPopup(`회원정보 저장 실패\nFirebase 계정은 만들어졌지만 회원정보 저장에 실패했습니다. 규칙을 확인한 뒤 다시 시도해 주세요.\n${friendlyError(error)}`);
    } else {
      authPopup(`${authMode === 'signup' ? '회원가입' : '로그인'} 실패\n${friendlyError(error)}`);
    }
  } finally {
    submit.disabled = false;
    setAuthMode(authMode);
  }
});
async function logoutCurrentUser() {
  if (!auth || !auth.currentUser) return authPopup('로그아웃 실패\n현재 로그인된 계정이 없습니다.');
  const userLabel=loggedInLabel(auth.currentUser);
  try {
    await signOut(auth);
    isAdmin=false;
    authPopup(`${userLabel} 계정이 로그아웃되었습니다.`);
  } catch(error) {
    authPopup(`로그아웃 실패\n${userLabel} 계정에서 로그아웃하지 못했습니다.\n${friendlyError(error)}`);
  }
}
$('#logout-button').addEventListener('click', logoutCurrentUser);
$('#my-bookings').addEventListener('click', () => { if (!requireLogin()) return; renderMyBookings(); openDialog('bookings-dialog'); });
$('#booking-form [name="checkIn"]').addEventListener('change', event => { const next=new Date(`${event.target.value}T00:00:00`); next.setDate(next.getDate()+1); $('#booking-form [name="checkOut"]').min=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`; });
$('#booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!databaseReady() || !currentUser || !selectedStay) return;
  const data = formObject(form);
  if (data.checkOut <= data.checkIn) return toast('체크아웃은 체크인 다음 날짜부터 선택해 주세요.');

  const alreadyRequested = bookings.some(item => item.userId === currentUser.uid
    && item.stayId === selectedStay.id
    && item.checkIn === data.checkIn
    && item.checkOut === data.checkOut
    && item.status !== 'cancelled');
  if (alreadyRequested) {
    closeDialog($('#booking-dialog'));
    openDialog('bookings-dialog');
    renderMyBookings();
    return toast('같은 일정의 예약 신청이 이미 있습니다. 내 예약에서 확인해 주세요.');
  }

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  const record = { ...data, stayId:selectedStay.id, stayName:selectedStay.name, userId:currentUser.uid, email:currentUser.email, status:'pending', createdAt:Date.now() };
  try {
    const bookingRef = push(ref(db,'bookings'));
    await set(bookingRef, record);
    bookings = [...bookings.filter(item => item.id !== bookingRef.key), { id:bookingRef.key, ...record }];
    renderMyBookings();
    form.reset();
    closeDialog($('#booking-dialog'));
    openDialog('booking-success-dialog');
  } catch (error) {
    toast(`예약 실패: ${friendlyError(error)}`);
  } finally {
    submit.disabled = false;
  }
});
$('#success-my-bookings').addEventListener('click', () => {
  closeDialog($('#booking-success-dialog'));
  renderMyBookings();
  openDialog('bookings-dialog');
});
$('#destination-search').addEventListener('input', renderDestinations); $('#search-button').addEventListener('click', () => $('#destinations').scrollIntoView({behavior:'smooth'})); $('#stay-destination').addEventListener('change', renderStays);
$('#destination-list').addEventListener('click', event => { const card=event.target.closest('[data-destination]'); if (card) showDestinationDetail(card.dataset.destination); });
$('#destination-detail').addEventListener('click', event => { const button=event.target.closest('[data-detail-book]'); if (button) startBooking(button.dataset.detailBook); });
$('#stay-list').addEventListener('click', event => { const button=event.target.closest('[data-book]'); if (button) startBooking(button.dataset.book); });
$$('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog')))); $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if(event.target===dialog) closeDialog(dialog); }));

const backToTopButton = $('#back-to-top');
const updateBackToTopVisibility = () => { backToTopButton.hidden = window.scrollY <= 180; };
window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
updateBackToTopVisibility();
backToTopButton.addEventListener('click', () => {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.scrollTo({ top: 0, behavior });
});

if (firebaseReady) {
  try { const [appSdk, authSdk, databaseSdk] = await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'), import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js')]); ({ initializeApp } = appSdk); ({ getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } = authSdk); ({ getDatabase, ref, onValue, push, set, query, orderByChild, equalTo } = databaseSdk); const app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app); onAuthStateChanged(auth, async user => { if (!user) { isAdmin=false; updateAuthUI(null); subscribeBookings(null); return; } isAdmin=isConfiguredAdmin(user); updateAuthUI(user); subscribeBookings(user); }); subscribeData(); }
  catch(error) { console.error(error); toast('Firebase 초기화에 실패했습니다. firebase-config.js를 확인해 주세요.'); destinations=fallbackDestinations; stays=fallbackStays; renderDestinations(); }
} else { destinations=fallbackDestinations; stays=fallbackStays; renderDestinations(); }

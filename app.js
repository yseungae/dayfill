const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const messages = {
  ko: {
    menuOpen: '메뉴 열기', menuClose: '메뉴 닫기', language: '언어 변경', refresh: '최신 버전 확인', overview: '올해의 시간',
    updateChecking: '최신 버전을 확인하고 있어요...', updateDone: 'Dayfill이 업데이트되었어요.', updateCurrent: '이미 최신 버전이에요.', updateFailed: '업데이트를 확인하지 못했어요. 잠시 후 다시 시도해주세요.',
    yearProgress: (p) => `올해의 ${p}%가 채워졌어요`, fridays: (n) => `앞으로 금요일이 ${n}번 남았어요`,
    todayQuestion: '오늘은 어땠나요?', addPhoto: '사진 추가', changePhoto: '사진 변경', removePhoto: '사진 삭제',
    placeholder: '오늘을 짧게 남겨보세요...', save: '오늘 기록하기', update: '수정 내용 저장', saved: '오늘의 기록을 저장했어요.',
    edit: '기록 수정', delete: '기록 삭제', deleteTitle: '기록을 삭제할까요?', deleteBody: '사진과 짧은 기록이 이 기기에서 삭제됩니다.',
    cancel: '취소', pastYears: '지난 연도', records: '남긴 기록', noRecords: '이 달에는 아직 남긴 기록이 없어요.',
    monthProgress: (m, p) => `${m}의 ${p}%가 채워졌어요`, back: '← 올해로 돌아가기', footer: '당신의 시간은 채워지고 있어요.',
    textRequired: '짧은 기록이나 사진 중 하나를 남겨주세요.', photoError: '사진을 불러오지 못했어요. 다른 사진을 선택해주세요.',
    months: Array.from({length: 12}, (_, i) => `${i + 1}월`), date: (d) => `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`,
    shortDate: (d) => `${d.getMonth()+1}월 ${d.getDate()}일`, current: '현재'
  },
  en: {
    menuOpen: 'Open menu', menuClose: 'Close menu', language: 'Change language', refresh: 'Check for updates', overview: 'Time lived this year',
    updateChecking: 'Checking for updates...', updateDone: 'Dayfill has been updated.', updateCurrent: "You're already up to date.", updateFailed: 'Could not check for updates. Please try again.',
    yearProgress: (p) => `This year is ${p}% filled`, fridays: (n) => `${n} Friday${n === 1 ? '' : 's'} left this year`,
    todayQuestion: 'How was today?', addPhoto: 'Add photo', changePhoto: 'Change photo', removePhoto: 'Remove photo',
    placeholder: 'Leave a few words about today...', save: 'Save today', update: 'Save changes', saved: 'Today’s moment is saved.',
    edit: 'Edit entry', delete: 'Delete entry', deleteTitle: 'Delete this entry?', deleteBody: 'The photo and note will be removed from this device.',
    cancel: 'Cancel', pastYears: 'Past Years', records: 'Moments saved', noRecords: 'No moments saved in this month yet.',
    monthProgress: (m, p) => `${m} is ${p}% filled`, back: '← Back to this year', footer: 'Your time is filling up.',
    textRequired: 'Add a short note or a photo.', photoError: 'We couldn’t read that photo. Please choose another.',
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    date: (d) => new Intl.DateTimeFormat('en-US', {month:'long', day:'numeric', year:'numeric'}).format(d),
    shortDate: (d) => new Intl.DateTimeFormat('en-US', {month:'long', day:'numeric'}).format(d), current: 'Now'
  }
};

const state = { language: localStorage.getItem('tt-language') || 'ko', view: 'home', year: new Date().getFullYear(), month: null, editing: false, photo: null };
const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('time-tattery', 1);
  request.onupgradeneeded = () => {
    const store = request.result.createObjectStore('entries', { keyPath: 'date' });
    store.createIndex('year', 'year');
    store.createIndex('yearMonth', 'yearMonth');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function dbAction(mode, callback) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('entries', mode);
    const request = callback(tx.objectStore('entries'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const getEntry = (date) => dbAction('readonly', store => store.get(date));
const putEntry = (entry) => dbAction('readwrite', store => store.put(entry));
const deleteEntry = (date) => dbAction('readwrite', store => store.delete(date));
const getAllEntries = () => dbAction('readonly', store => store.getAll());

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function yearPercent(date = new Date(), year = date.getFullYear()) {
  if (year < date.getFullYear()) return 100;
  if (year > date.getFullYear()) return 0;
  const day = Math.floor((new Date(year, date.getMonth(), date.getDate()) - new Date(year, 0, 1)) / 86400000) + 1;
  const days = (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000;
  return Math.round(day / days * 100);
}
function monthPercent(month, year = new Date().getFullYear(), now = new Date()) {
  const marker = year * 12 + month, current = now.getFullYear() * 12 + now.getMonth();
  if (marker < current) return 100;
  if (marker > current) return 0;
  return Math.round(now.getDate() / new Date(year, month + 1, 0).getDate() * 100);
}
function remainingFridays(date = new Date()) {
  const cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let count = 0;
  while (cursor.getFullYear() === date.getFullYear()) {
    if (cursor.getDay() === 5) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
function batteryMarkup(percent, label, fills = null) {
  const segmentFills = fills || Array.from({length: 12}, (_, i) => Math.max(0, Math.min(1, percent / (100 / 12) - i)));
  const cells = segmentFills.map((fill, i) => {
    return `<span class="battery-cell" aria-hidden="true"><i style="transform:scaleX(${fill})"></i>${i < 11 ? '<b></b>' : ''}</span>`;
  }).join('');
  return `<div class="battery-wrap"><div class="battery" role="img" aria-label="${label}: ${percent}%">${cells}</div></div>`;
}
function t(key, ...args) { const value = messages[state.language][key]; return typeof value === 'function' ? value(...args) : value; }
function syncStaticText() {
  document.documentElement.lang = state.language;
  $$('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  $('#menuButton').ariaLabel = t('menuOpen'); $('#closeMenu').ariaLabel = t('menuClose'); $('#languageButton').ariaLabel = t('language'); $('#refreshButton').ariaLabel = t('refresh');
  $$('[data-language]').forEach(button => button.classList.toggle('active', button.dataset.language === state.language));
}

async function renderHome() {
  const now = new Date(); state.year = now.getFullYear(); state.month = null; state.view = 'home';
  const progress = yearPercent(now); const todayKey = localDateKey(now); const entry = await getEntry(todayKey);
  $('#app').innerHTML = `<section class="hero">
    <p class="eyebrow">${t('overview')}</p><h1 class="year">${now.getFullYear()}</h1>
    ${batteryMarkup(progress, t('overview'), Array.from({length: 12}, (_, month) => monthPercent(month, now.getFullYear(), now) / 100))}<p class="progress-copy">${t('yearProgress', progress)}</p>
    <p class="fridays">${t('fridays', remainingFridays(now))}</p>
  </section>
  <section class="today-section">
    <div class="section-heading"><div><p>${t('date', now)}</p><h2>${t('todayQuestion')}</h2></div><span class="counter">${entry ? '01 / 01' : '00 / 01'}</span></div>
    <div id="entryArea"></div>
  </section>`;
  renderEntryArea(entry); renderMenu();
}

function renderEntryArea(entry, editing = false) {
  const area = $('#entryArea');
  if (entry && !editing) {
    const photoUrl = entry.photo ? URL.createObjectURL(entry.photo) : null;
    area.innerHTML = `<article class="saved-entry">${photoUrl ? `<img src="${photoUrl}" alt="">` : ''}${entry.text ? `<blockquote>${escapeHtml(entry.text)}</blockquote>` : ''}
      <div class="entry-actions"><button class="button ghost" id="editEntry">${icon('edit')}${t('edit')}</button><button class="button ghost" id="deleteEntry">${icon('trash')}${t('delete')}</button></div></article>`;
    $('#editEntry').onclick = () => { state.photo = entry.photo || null; renderEntryArea(entry, true); };
    $('#deleteEntry').onclick = () => $('#confirmDialog').showModal();
    return;
  }
  state.photo = editing && entry ? entry.photo || null : null;
  area.innerHTML = `<form class="entry-form" id="entryForm">
    <input class="photo-input" id="photoInput" type="file" accept="image/*">
    <label class="photo-drop" for="photoInput" id="photoDrop"><span class="photo-prompt">${icon('image')} ${state.photo ? t('changePhoto') : t('addPhoto')}</span></label>
    <div class="photo-controls" id="photoControls" ${state.photo ? '' : 'hidden'}><button class="button ghost" type="button" id="removePhoto">${icon('trash')}${t('removePhoto')}</button></div>
    <textarea id="entryText" maxlength="500" placeholder="${t('placeholder')}">${entry ? escapeHtml(entry.text || '') : ''}</textarea>
    <button class="button" type="submit">${editing ? t('update') : t('save')}</button><p class="form-note" id="formNote" aria-live="polite"></p>
  </form>`;
  updatePhotoPreview();
  $('#photoInput').onchange = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try { state.photo = await compressImage(file); updatePhotoPreview(); } catch { $('#formNote').textContent = t('photoError'); }
  };
  $('#removePhoto').onclick = () => { state.photo = null; $('#photoInput').value = ''; updatePhotoPreview(); };
  $('#entryForm').onsubmit = async (event) => {
    event.preventDefault(); const text = $('#entryText').value.trim();
    if (!text && !state.photo) { $('#formNote').textContent = t('textRequired'); return; }
    const now = new Date(); const key = localDateKey(now);
    await putEntry({ date: key, year: now.getFullYear(), month: now.getMonth(), yearMonth: `${now.getFullYear()}-${now.getMonth()}`, text, photo: state.photo, updatedAt: Date.now() });
    const saved = await getEntry(key); renderEntryArea(saved); renderMenu();
  };
}
function updatePhotoPreview() {
  const drop = $('#photoDrop'); if (!drop) return;
  $('img', drop)?.remove();
  $('.photo-prompt', drop).innerHTML = `${icon('image')} ${state.photo ? t('changePhoto') : t('addPhoto')}`;
  $('#photoControls').hidden = !state.photo;
  if (state.photo) { const img = new Image(); img.src = URL.createObjectURL(state.photo); img.alt = ''; drop.prepend(img); }
}
async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('invalid');
  const bitmap = await createImageBitmap(file); const max = 1600; const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('compress')), 'image/jpeg', .84));
}

async function renderMonth(year, month) {
  state.view = 'month'; state.year = year; state.month = month; closeMenu();
  const p = monthPercent(month, year); const entries = (await getAllEntries()).filter(e => e.year === year && e.month === month).sort((a,b) => a.date.localeCompare(b.date));
  const cards = entries.map(entry => { const d = new Date(`${entry.date}T12:00:00`); const src = entry.photo ? URL.createObjectURL(entry.photo) : '';
    return `<article class="entry-card">${src ? `<img src="${src}" alt="">` : ''}<time datetime="${entry.date}">${t('shortDate', d)}</time>${entry.text ? `<p>${escapeHtml(entry.text)}</p>` : ''}</article>`;
  }).join('');
  $('#app').innerHTML = `<section class="month-view"><button class="back-button" id="backHome">${t('back')}</button><section class="hero">
    <p class="eyebrow">${year}</p><h1 class="year">${t('months')[month]}</h1>${batteryMarkup(p, t('months')[month])}
    <p class="progress-copy">${t('monthProgress', t('months')[month], p)}</p></section>
    <section class="month-records"><h2>${t('records')}</h2>${cards ? `<div class="entry-grid">${cards}</div>` : `<div class="empty-state">${t('noRecords')}</div>`}</section></section>`;
  $('#backHome').onclick = renderHome; renderMenu(); $('#app').focus(); window.scrollTo({top: 0, behavior: 'smooth'});
}
async function renderMenu() {
  const now = new Date(); $('#menuYear').textContent = state.year;
  $('#monthNavigation').innerHTML = t('months').map((name, month) => { const p = monthPercent(month, state.year, now); const current = state.year === now.getFullYear() && month === now.getMonth();
    return `<button class="month-link ${current ? 'current' : ''}" data-month="${month}"><span>${name}</span><span class="mini-battery" role="img" aria-label="${name} ${p}%"><i class="mini-battery-fill" style="--progress:${p}%"></i></span><em>${p}%</em></button>`;
  }).join('');
  $$('[data-month]', $('#monthNavigation')).forEach(button => button.onclick = () => renderMonth(state.year, Number(button.dataset.month)));
  const years = [...new Set((await getAllEntries()).map(e => e.year))].filter(y => y < now.getFullYear()).sort((a,b) => b-a);
  $('#pastYears').innerHTML = years.length ? years.map(y => `<button class="past-year-button" data-year="${y}">${y}</button>`).join('<br>') : '—';
  $$('[data-year]', $('#pastYears')).forEach(button => button.onclick = () => { state.year = Number(button.dataset.year); renderMenu(); });
}
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
let toastTimer;
function showUpdateToast(message, duration = 2600) {
  const toast = $('#updateToast');
  clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
  if (duration) toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
}

let updateInProgress = false;
let reloadTriggered = false;
async function waitForInstalled(worker, timeout = 10000) {
  if (!worker || worker.state === 'installed' || worker.state === 'activated') return worker;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(worker), timeout);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
        clearTimeout(timer); resolve(worker);
      }
    });
  });
}

async function checkForAppUpdate() {
  if (updateInProgress) return;
  updateInProgress = true;
  const button = $('#refreshButton'); button.classList.add('spinning'); button.disabled = true;
  showUpdateToast(t('updateChecking'), 0);
  try {
    state.view === 'home' ? await renderHome() : await renderMonth(state.year, state.month);
    if (!('serviceWorker' in navigator)) { showUpdateToast(t('updateCurrent')); return; }
    const registration = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    let discoveredWorker = registration.waiting || registration.installing || null;
    const onUpdateFound = () => { discoveredWorker = registration.installing; };
    registration.addEventListener('updatefound', onUpdateFound);
    await registration.update();
    await new Promise(resolve => setTimeout(resolve, 350));
    registration.removeEventListener('updatefound', onUpdateFound);
    discoveredWorker = registration.waiting || registration.installing || discoveredWorker;
    if (!discoveredWorker) { showUpdateToast(t('updateCurrent')); return; }
    const worker = await waitForInstalled(discoveredWorker);
    if (worker.state === 'redundant') throw new Error('Service Worker installation failed');
    (registration.waiting || worker).postMessage('SKIP_WAITING');
  } catch (error) {
    console.error('Dayfill update check failed:', error);
    showUpdateToast(t('updateFailed'), 3600);
  } finally {
    updateInProgress = false; button.disabled = false;
    setTimeout(() => button.classList.remove('spinning'), 420);
  }
}
function icon(name) {
  const paths = {
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7M10 11v5M14 11v5"/>'
  };
  return `<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}
function openMenu() { $('#sideMenu').classList.add('open'); $('#sideMenu').ariaHidden = 'false'; $('#scrim').hidden = false; $('#menuButton').ariaExpanded = 'true'; }
function closeMenu() { $('#sideMenu').classList.remove('open'); $('#sideMenu').ariaHidden = 'true'; $('#scrim').hidden = true; $('#menuButton').ariaExpanded = 'false'; }

$('#menuButton').onclick = openMenu; $('#closeMenu').onclick = closeMenu; $('#scrim').onclick = closeMenu; $('#homeButton').onclick = renderHome;
$('#refreshButton').onclick = checkForAppUpdate;
$('#languageButton').onclick = () => { const pop = $('#languagePopover'); pop.hidden = !pop.hidden; $('#languageButton').ariaExpanded = String(!pop.hidden); };
$$('[data-language]').forEach(button => button.onclick = async () => { state.language = button.dataset.language; localStorage.setItem('tt-language', state.language); $('#languagePopover').hidden = true; syncStaticText(); state.view === 'home' ? await renderHome() : await renderMonth(state.year, state.month); });
$('#cancelDelete').onclick = () => $('#confirmDialog').close();
$('#confirmDelete').onclick = async () => { await deleteEntry(localDateKey()); $('#confirmDialog').close(); await renderHome(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
document.addEventListener('click', e => { if (!e.target.closest('.language-wrap')) $('#languagePopover').hidden = true; });

syncStaticText(); renderHome();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadTriggered) {
      reloadTriggered = true;
      sessionStorage.setItem('dayfill-update-applied', '1');
      window.location.reload();
    }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }));
}
if (sessionStorage.getItem('dayfill-update-applied') === '1') {
  sessionStorage.removeItem('dayfill-update-applied');
  showUpdateToast(t('updateDone'), 3200);
}
let activeDay = localDateKey(); setInterval(() => { const next = localDateKey(); if (next !== activeDay) { activeDay = next; renderHome(); } }, 60000);

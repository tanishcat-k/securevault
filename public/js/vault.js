let secrets = [];
let currentType = 'all';
let editingId = null;
let viewed = null; // the secret that is open in the view dialog
let secretVisible = false;

const cards = document.getElementById('cards');
const formDialog = document.getElementById('formDialog');
const viewDialog = document.getElementById('viewDialog');

const typeNames = { password: 'Password', note: 'Secure note', apikey: 'API key', file: 'File' };
const headings = {
  all: 'All secrets', password: 'Passwords', note: 'Secure notes',
  apikey: 'API keys', file: 'Files', log: 'Activity log'
};

// ---------- start ----------
async function start() {
  const me = await api('/api/auth/me');
  document.getElementById('userName').textContent = me.name;
  if (me.role === 'admin') {
    document.getElementById('adminLink').hidden = false;
  }

  await loadSecrets();
  generatePassword();
  startIdleTimer();
}

async function loadSecrets() {
  secrets = await api('/api/vault');
  updateCounts();
  showCards();
}

function updateCounts() {
  document.getElementById('count-all').textContent = secrets.length;
  for (const type of Object.keys(typeNames)) {
    const total = secrets.filter((s) => s.type === type).length;
    document.getElementById('count-' + type).textContent = total;
  }
}

// ---------- cards ----------
function showCards() {
  const search = document.getElementById('search').value.toLowerCase();
  cards.innerHTML = '';

  const list = secrets.filter((s) => {
    const rightType = currentType === 'all' || s.type === currentType;
    const matches = s.title.toLowerCase().includes(search) || (s.extra || '').toLowerCase().includes(search);
    return rightType && matches;
  });

  document.getElementById('empty').hidden = list.length > 0;

  for (const s of list) {
    cards.append(makeCard(s));
  }
}

function makeCard(s) {
  const card = make('div', 'card ' + s.type);
  card.append(make('div', 'type', typeNames[s.type]));
  card.append(make('h3', '', s.title));
  card.append(make('div', 'extra', s.extra));

  const actions = make('div', 'actions');

  const openBtn = make('button', 'small-btn', 'Open');
  openBtn.onclick = () => openSecret(s.id);

  const editBtn = make('button', 'small-btn', 'Edit');
  editBtn.onclick = () => openEdit(s.id);

  const deleteBtn = make('button', 'small-btn danger', 'Delete');
  deleteBtn.onclick = () => deleteSecret(s.id, s.title);

  actions.append(openBtn, editBtn, deleteBtn);
  card.append(actions);
  return card;
}

// ---------- left menu ----------
for (const button of document.querySelectorAll('.drawer')) {
  button.onclick = () => {
    document.querySelector('.drawer.active').classList.remove('active');
    button.classList.add('active');

    currentType = button.dataset.type;
    document.getElementById('heading').textContent = headings[currentType];

    const isLog = currentType === 'log';
    cards.hidden = isLog;
    document.getElementById('logTable').hidden = !isLog;
    document.getElementById('addBtn').hidden = isLog;

    if (isLog) {
      document.getElementById('empty').hidden = true;
      loadLog();
    } else {
      showCards();
    }
  };
}

document.getElementById('search').oninput = showCards;

async function loadLog() {
  const logs = await api('/api/logs');
  const body = document.getElementById('logBody');
  body.innerHTML = '';

  for (const l of logs) {
    const row = make('tr');
    const bad = /FAILED|LOCKED|BLOCKED/.test(l.action);
    row.append(make('td', '', formatTime(l.created_at)));
    row.append(make('td', bad ? 'bad' : '', l.action));
    row.append(make('td', '', l.ip || '-'));
    body.append(row);
  }
}

// ---------- add / edit form ----------
function updateFormFields() {
  const type = document.getElementById('type').value;
  const isFile = type === 'file';

  document.getElementById('secret').hidden = isFile;
  document.getElementById('fileInput').hidden = !isFile;
  document.getElementById('fillGenBtn').hidden = type !== 'password';

  const labels = {
    password: ['USERNAME', 'PASSWORD'],
    note: ['TAG (optional)', 'NOTE'],
    apikey: ['SERVICE (optional)', 'API KEY'],
    file: ['FILE NAME (filled automatically)', 'CHOOSE FILE']
  };
  document.getElementById('extraLabel').textContent = labels[type][0];
  document.getElementById('secretLabel').textContent = labels[type][1];
}

document.getElementById('type').onchange = updateFormFields;

function openAdd() {
  editingId = null;
  document.getElementById('secretForm').reset();
  document.getElementById('formTitle').textContent = 'ADD SECRET';
  document.getElementById('formError').hidden = true;
  updateFormFields();
  formDialog.showModal();
}

async function openEdit(id) {
  const s = await api('/api/vault/' + id);

  editingId = id;
  document.getElementById('formTitle').textContent = 'EDIT SECRET';
  document.getElementById('formError').hidden = true;
  document.getElementById('type').value = s.type;
  document.getElementById('title').value = s.title;
  document.getElementById('extra').value = s.extra;
  document.getElementById('secret').value = s.type === 'file' ? '' : s.secret;
  updateFormFields();
  formDialog.showModal();
}

// reads the chosen file and gives back base64 text
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

document.getElementById('secretForm').onsubmit = async (e) => {
  e.preventDefault();

  const type = document.getElementById('type').value;
  let extra = document.getElementById('extra').value;
  let secret = document.getElementById('secret').value;

  try {
    if (type === 'file') {
      const file = document.getElementById('fileInput').files[0];
      if (!file) throw new Error('Please choose a file');
      if (file.size > 1000000) throw new Error('File is too big (max 1 MB)');
      secret = await readFile(file);
      extra = file.name;
    }

    const data = { type: type, title: document.getElementById('title').value, extra: extra, secret: secret };

    if (editingId) {
      await api('/api/vault/' + editingId, 'PUT', data);
    } else {
      await api('/api/vault', 'POST', data);
    }

    formDialog.close();
    loadSecrets();
  } catch (err) {
    showMessage('formError', err.message, true);
  }
};

document.getElementById('addBtn').onclick = openAdd;
document.getElementById('cancelBtn').onclick = () => formDialog.close();

document.getElementById('fillGenBtn').onclick = () => {
  generatePassword();
  document.getElementById('secret').value = document.getElementById('genOutput').value;
};

// ---------- open a secret ----------
async function openSecret(id) {
  viewed = await api('/api/vault/' + id);
  secretVisible = false;

  document.getElementById('viewTitle').textContent = viewed.title;
  document.getElementById('viewExtra').textContent = viewed.extra;
  document.getElementById('downloadBtn').hidden = viewed.type !== 'file';
  document.getElementById('copyBtn').hidden = viewed.type === 'file';
  document.getElementById('showBtn').hidden = viewed.type === 'file';

  const box = document.getElementById('viewSecret');
  box.textContent = viewed.type === 'file' ? 'Encrypted file: ' + viewed.extra : '••••••••••••';
  document.getElementById('showBtn').textContent = 'Show';
  viewDialog.showModal();
}

document.getElementById('showBtn').onclick = () => {
  secretVisible = !secretVisible;
  document.getElementById('viewSecret').textContent = secretVisible ? viewed.secret : '••••••••••••';
  document.getElementById('showBtn').textContent = secretVisible ? 'Hide' : 'Show';
};

document.getElementById('copyBtn').onclick = () => copyText(viewed.secret);

document.getElementById('downloadBtn').onclick = () => {
  // base64 text -> real file
  const bytes = Uint8Array.from(atob(viewed.secret), (c) => c.charCodeAt(0));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([bytes]));
  link.download = viewed.extra;
  link.click();
};

document.getElementById('closeBtn').onclick = () => {
  viewed = null; // forget the secret
  document.getElementById('viewSecret').textContent = '';
  viewDialog.close();
};

async function deleteSecret(id, title) {
  if (!confirm('Delete "' + title + '"?')) return;
  await api('/api/vault/' + id, 'DELETE');
  loadSecrets();
}

// copies text and clears the clipboard after 30 seconds
function copyText(text) {
  navigator.clipboard.writeText(text);
  setTimeout(() => navigator.clipboard.writeText(''), 30000);
}

// ---------- password generator ----------
const genLength = document.getElementById('genLength');

function randomNumber(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array); // secure random, not Math.random
  return array[0] % max;
}

function generatePassword() {
  const sets = ['abcdefghijklmnopqrstuvwxyz'];
  if (document.getElementById('genUpper').checked) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  if (document.getElementById('genNumbers').checked) sets.push('0123456789');
  if (document.getElementById('genSymbols').checked) sets.push('!@#$%^&*()-_=+?');

  const all = sets.join('');
  let password = '';

  // keep generating until every chosen type is present
  do {
    password = '';
    for (let i = 0; i < genLength.value; i++) {
      password += all[randomNumber(all.length)];
    }
  } while (!sets.every((set) => [...password].some((c) => set.includes(c))));

  document.getElementById('genOutput').value = password;
}

genLength.oninput = () => {
  document.getElementById('genLengthText').textContent = genLength.value;
  generatePassword();
};
document.getElementById('genBtn').onclick = generatePassword;
document.getElementById('genCopyBtn').onclick = () => copyText(document.getElementById('genOutput').value);
for (const id of ['genUpper', 'genNumbers', 'genSymbols']) {
  document.getElementById(id).onchange = generatePassword;
}

document.getElementById('logoutBtn').onclick = () => logout('manual');

start();

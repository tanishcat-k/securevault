async function loadUsers() {
  const users = await api('/api/admin/users');
  const body = document.getElementById('userBody');
  body.innerHTML = '';

  for (const u of users) {
    const row = make('tr');
    const locked = u.locked_until > Date.now();

    row.append(make('td', '', u.name));
    row.append(make('td', '', u.email));
    row.append(make('td', '', u.role));
    row.append(make('td', locked ? 'bad' : '', locked ? 'LOCKED' : 'active'));

    const actions = make('td');

    if (locked) {
      const unlockBtn = make('button', 'small-btn', 'Unlock');
      unlockBtn.onclick = async () => {
        await api('/api/admin/users/' + u.id + '/unlock', 'POST');
        refresh();
      };
      actions.append(unlockBtn);
    }

    if (u.role !== 'admin') {
      const deleteBtn = make('button', 'small-btn danger', 'Delete');
      deleteBtn.onclick = async () => {
        if (!confirm('Delete ' + u.email + ' and all their secrets?')) return;
        await api('/api/admin/users/' + u.id, 'DELETE');
        refresh();
      };
      actions.append(deleteBtn);
    }

    row.append(actions);
    body.append(row);
  }
}

async function loadLogs() {
  const logs = await api('/api/admin/logs');
  const body = document.getElementById('logBody');
  body.innerHTML = '';

  for (const l of logs) {
    const row = make('tr');
    const bad = /FAILED|LOCKED|BLOCKED/.test(l.action);

    row.append(make('td', '', formatTime(l.created_at)));
    row.append(make('td', '', l.email || '-'));
    row.append(make('td', bad ? 'bad' : '', l.action));
    row.append(make('td', '', l.ip || '-'));
    body.append(row);
  }
}

async function refresh() {
  await loadUsers();
  await loadLogs();
}

async function start() {
  try {
    await refresh();
  } catch (err) {
    // not an admin -> back to the vault
    location.href = '/vault.html';
    return;
  }
  startIdleTimer();
}

start();

// small helper functions used by every page

const IDLE_SECONDS = 290; // a bit less than the 5 minute server timeout
let secondsLeft = IDLE_SECONDS;

// calls the backend and returns the json
async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  // session ended on a private page -> go back to login
  if (res.status === 401 && document.body.dataset.private) {
    location.href = '/index.html?expired=1';
  }

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  secondsLeft = IDLE_SECONDS; // any request restarts the idle timer
  return data;
}

// creates an element safely (textContent, so no HTML injection)
function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatTime(dbTime) {
  return new Date(dbTime.replace(' ', 'T') + 'Z').toLocaleString();
}

function showMessage(id, text, isError) {
  const box = document.getElementById(id);
  box.textContent = text;
  box.className = isError ? 'message error' : 'message';
  box.hidden = false;
}

async function logout(reason) {
  try {
    await api('/api/auth/logout', 'POST', { reason: reason });
  } catch (err) {
    // ignore, we go to the login page anyway
  }
  location.href = '/index.html' + (reason === 'timeout' ? '?expired=1' : '');
}

// auto logout countdown (private pages only)
function startIdleTimer() {
  const timer = document.getElementById('timer');

  setInterval(() => {
    secondsLeft--;

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    timer.textContent = `Auto-logout in ${minutes}:${seconds}`;

    if (secondsLeft <= 0) {
      logout('timeout');
    }
  }, 1000);
}

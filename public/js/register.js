const password = document.getElementById('password');

// simple strength hint while typing
password.addEventListener('input', () => {
  const p = password.value;
  let score = 0;
  if (p.length >= 10) score++;
  if (p.length >= 14) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;

  const levels = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'];
  document.getElementById('strength').textContent = p ? 'Strength: ' + levels[score] : '';
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (password.value !== document.getElementById('confirm').value) {
    showMessage('message', 'Passwords do not match', true);
    return;
  }

  try {
    await api('/api/auth/register', 'POST', {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: password.value
    });
    location.href = '/index.html?registered=1';
  } catch (err) {
    showMessage('message', err.message, true);
  }
});

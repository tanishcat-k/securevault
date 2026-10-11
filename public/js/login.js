const loginForm = document.getElementById('loginForm');
const otpForm = document.getElementById('otpForm');

const params = new URLSearchParams(location.search);
if (params.get('expired')) {
  showMessage('message', 'Vault sealed. Your session ended, please log in again.', false);
}
if (params.get('registered')) {
  showMessage('message', 'Vault created. Log in to set up your authenticator app.', false);
}

// step 1: email + master password
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const data = await api('/api/auth/login', 'POST', {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    });

    loginForm.hidden = true;
    otpForm.hidden = false;
    document.getElementById('message').hidden = true;

    // the QR code only comes on the first login
    if (data.qr) {
      document.getElementById('qrImage').src = data.qr;
      document.getElementById('secretText').textContent = data.secret;
      document.getElementById('qrBox').hidden = false;
    }

    document.getElementById('code').focus();
  } catch (err) {
    showMessage('message', err.message, true);
  }
});

// step 2: one-time code
otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    await api('/api/auth/otp', 'POST', { code: document.getElementById('code').value });
    location.href = '/vault.html';
  } catch (err) {
    showMessage('message', err.message, true);
  }
});

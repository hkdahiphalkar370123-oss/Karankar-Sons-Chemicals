document.addEventListener('DOMContentLoaded', () => {
  const user = window.API.getCurrentUser();
  const form = document.getElementById('service-booking-form');
  const message = document.getElementById('service-booking-msg');

  const setMessage = (text, type = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.style.display = 'block';
    message.style.background = type === 'error' ? 'rgba(180,35,24,0.1)' : 'rgba(6,118,71,0.1)';
    message.style.color = type === 'error' ? '#b42318' : '#067647';
    message.style.border = type === 'error' ? '1px solid rgba(180,35,24,0.2)' : '1px solid rgba(6,118,71,0.2)';
  };

  if (user) {
    const loginBtn = document.getElementById('sb-login-btn');
    if (loginBtn) loginBtn.style.display = 'none';

    const dateInput = document.getElementById('sb-startDate');
    const profileDate = new Date();
    profileDate.setDate(profileDate.getDate() + 3);
    dateInput.min = profileDate.toISOString().split('T')[0];
  } else {
    setMessage('Login to submit a detailed booking request. You can still review the service request details here.', 'info');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    try {
      await window.API.createService({
        serviceName: document.getElementById('sb-serviceName').value.trim(),
        projectType: document.getElementById('sb-projectType').value,
        siteAddress: document.getElementById('sb-siteAddress').value.trim(),
        preferredStartDate: document.getElementById('sb-startDate').value,
        notes: document.getElementById('sb-notes').value.trim(),
        status: 'Pending'
      });

      setMessage('Booking request submitted successfully.', 'success');
      form.reset();
    } catch (error) {
      setMessage(error.message || 'Failed to submit booking request', 'error');
    }
  });
});
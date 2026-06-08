/* ═══════════════════════════════════════
   Kerry Care Beauty Studio — Main JS
═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Nav: encoge al hacer scroll ── */
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    nav.style.padding = window.scrollY > 60 ? '12px 56px' : '20px 56px';
  });

  /* ── Fecha mínima = hoy ── */
  const dateInput = document.querySelector('input[type="date"]');
  if (dateInput) {
    dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
  }

  /* ── Formulario de citas → /api/booking ── */
  const form = document.getElementById('booking-form');
  const btnSubmit = document.getElementById('btn-submit');
  const formSuccess = document.getElementById('form-success');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Estado de carga
      btnSubmit.textContent = 'Enviando...';
      btnSubmit.disabled = true;

      const data = {
        nombre:   form.nombre.value.trim(),
        telefono: form.telefono.value.trim(),
        servicio: form.servicio.value,
        fecha:    form.fecha.value,
        hora:     form.hora.value,
        mensaje:  form.mensaje.value.trim()
      };

      try {
        const resp = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await resp.json();

        if (resp.ok && result.ok) {
          // Mostrar mensaje de éxito
          form.style.display = 'none';
          formSuccess.style.display = 'flex';
        } else {
          throw new Error(result.error || 'Error al enviar');
        }

      } catch (err) {
        alert('Hubo un problema al enviar. Por favor escríbenos directamente al WhatsApp: +506 7141-1368');
        btnSubmit.textContent = 'Enviar solicitud';
        btnSubmit.disabled = false;
      }
    });
  }

});

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
          // Descargar .ics para agregar al calendario
          descargarICS(data);
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

  /* ── Generador de archivo .ics ── */
  function descargarICS({ nombre, servicio, fecha, hora }) {
    // Convertir fecha y hora a formato iCal: YYYYMMDDTHHMMSS
    const [y, m, d] = fecha.split('-');
    const [hh, mm]  = hora.split(':');
    const dtStart   = `${y}${m}${d}T${hh}${mm}00`;
    const endHour   = String(parseInt(hh) + 1).padStart(2, '0');
    const dtEnd     = `${y}${m}${d}T${endHour}${mm}00`;
    const uid       = `kerrycare-${Date.now()}@kerrycare.netlify.app`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Kerry Care Beauty Studio//ES',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Cita Kerry Care — ${servicio}`,
      `DESCRIPTION:Hola ${nombre}\\, tu cita de ${servicio} en Kerry Care Beauty Studio.`,
      'LOCATION:Kerry Care Beauty Studio\\, Alajuelita\\, San José',
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      `DESCRIPTION:Recordatorio: cita de ${servicio} en 1 hora`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cita-kerrycare-${fecha}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

});

/* ═══════════════════════════════════════
   Kerry Care Beauty Studio — Main JS
═══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Nav: encoge al hacer scroll ── */
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    nav.style.padding = window.scrollY > 60 ? '12px 56px' : '20px 56px';
  });

  /* ══════════════════════════════════════════
     DATE PICKER — calendario con disponibilidad
  ══════════════════════════════════════════ */
  const MESES_DP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  let dpRef  = new Date();          // mes visible
  dpRef.setDate(1);
  let dpDisp = null;                // { horarios, diasBloqueados }

  function dpDiaDisponible(fecha) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    if (fecha < hoy) return false;  // pasado
    if (!dpDisp) return true;       // aún cargando → todo disponible
    const dow = fecha.getDay();
    const horario = dpDisp.horarios.find(h => h.dia_semana === dow);
    if (!horario || !horario.activo) return false;
    const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}-${String(fecha.getDate()).padStart(2,'0')}`;
    return !dpDisp.diasBloqueados.includes(fechaStr);
  }

  function dpRender() {
    const grid  = document.getElementById('dp-days-grid');
    const label = document.getElementById('dp-month-label');
    if (!grid || !label) return;

    const y = dpRef.getFullYear();
    const m = dpRef.getMonth();
    label.textContent = `${MESES_DP[m]} ${y}`;

    const hoy       = new Date(); hoy.setHours(0,0,0,0);
    const primerDow = new Date(y, m, 1).getDay();
    const diasEnMes = new Date(y, m + 1, 0).getDate();
    const fechaSel  = document.getElementById('inp-fecha')?.value || '';

    let html = '';
    for (let i = 0; i < primerDow; i++) html += '<div class="dp-day"></div>';

    for (let d = 1; d <= diasEnMes; d++) {
      const fecha    = new Date(y, m, d);
      const fechaStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const esHoy    = fecha.getTime() === hoy.getTime();
      const disp     = dpDiaDisponible(fecha);
      const selec    = fechaStr === fechaSel;

      let cls = 'dp-day';
      if (disp)  cls += ' dp-disponible';
      else       cls += ' dp-no-disponible';
      if (esHoy && disp) cls += ' dp-hoy';
      if (selec) cls += ' dp-selected';

      const onclick = disp ? `dpSeleccionar('${fechaStr}', ${d}, '${MESES_DP[m]}')` : '';
      html += `<div class="${cls}"${onclick ? ` onclick="${onclick}"` : ''}>${d}</div>`;
    }

    grid.innerHTML = html;
  }

  // Convierte "HH:MM" (24h) a texto legible tipo "12:00 md" / "6:00 pm"
  function fmtHora12(hhmm) {
    if (!hhmm) return '';
    const [hStr, m] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    const esMediodia = h === 12 && m === '00';
    const esMedianoche = h === 0 && m === '00';
    const sufijo = h < 12 ? 'am' : 'pm';
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    if (esMediodia) return '12md';
    if (esMedianoche) return '12mn';
    return `${h12}:${m}${sufijo}`;
  }

  // Aplica el rango de horas permitido (hora_inicio/hora_fin) al input
  // según el horario configurado para el día de la semana seleccionado.
  function dpAplicarRangoHora(fechaStr) {
    const inpHora = document.getElementById('f-hora');
    const hint    = document.getElementById('f-hora-hint');
    if (!inpHora) return;

    if (!dpDisp) {
      inpHora.removeAttribute('min');
      inpHora.removeAttribute('max');
      if (hint) hint.textContent = '';
      return;
    }

    const [y, m, d] = fechaStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const horario = dpDisp.horarios.find(h => h.dia_semana === dow);

    if (horario && horario.activo && horario.hora_inicio && horario.hora_fin) {
      inpHora.min = horario.hora_inicio;
      inpHora.max = horario.hora_fin;
      // Si ya había una hora elegida fuera del nuevo rango, se limpia
      if (inpHora.value && (inpHora.value < horario.hora_inicio || inpHora.value > horario.hora_fin)) {
        inpHora.value = '';
      }
      if (hint) hint.textContent = `Horario disponible: ${fmtHora12(horario.hora_inicio)} – ${fmtHora12(horario.hora_fin)}`;
    } else {
      inpHora.removeAttribute('min');
      inpHora.removeAttribute('max');
      if (hint) hint.textContent = '';
    }
  }

  window.dpSeleccionar = function(fechaStr, dia, mesNombre) {
    const inp = document.getElementById('inp-fecha');
    if (inp) inp.value = fechaStr;
    const txt = document.getElementById('dp-selected-text');
    if (txt) {
      txt.textContent = `✓ ${dia} de ${mesNombre}`;
      txt.classList.add('has-date');
    }
    dpAplicarRangoHora(fechaStr);
    dpRender();
  };

  document.getElementById('dp-prev')?.addEventListener('click', () => {
    dpRef.setMonth(dpRef.getMonth() - 1);
    dpRender();
  });
  document.getElementById('dp-next')?.addEventListener('click', () => {
    dpRef.setMonth(dpRef.getMonth() + 1);
    dpRender();
  });

  // Cargar disponibilidad y renderizar
  (async () => {
    dpRender(); // render inmediato sin datos (evita flash vacío)
    try {
      const r = await fetch('/api/disponibilidad');
      if (r.ok) dpDisp = await r.json();
    } catch {}
    dpRender(); // re-render con datos reales
  })();

  /* ── Formulario de citas → /api/booking ── */
  const form = document.getElementById('booking-form');
  const btnSubmit = document.getElementById('btn-submit');
  const formSuccess = document.getElementById('form-success');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validar fecha seleccionada
      if (!form.fecha.value) {
        alert('Por favor seleccioná una fecha disponible en el calendario.');
        return;
      }

      // Validar que la hora esté dentro del horario configurado para ese día
      // (el servidor también lo valida, pero avisamos antes de enviar)
      const inpHora = document.getElementById('f-hora');
      if (inpHora && inpHora.min && inpHora.max) {
        if (form.hora.value < inpHora.min || form.hora.value > inpHora.max) {
          alert(`Por favor elegí una hora entre ${fmtHora12(inpHora.min)} y ${fmtHora12(inpHora.max)} para ese día.`);
          return;
        }
      }

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
        } else if (resp.status === 409) {
          alert(result.error || 'Ese horario ya está ocupado. Por favor elegí otra hora.');
          btnSubmit.textContent = 'Enviar solicitud';
          btnSubmit.disabled = false;
        } else if (resp.status === 429) {
          alert('Has enviado demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.');
          btnSubmit.textContent = 'Enviar solicitud';
          btnSubmit.disabled = false;
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
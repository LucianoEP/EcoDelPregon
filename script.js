/* El eco del pregón · script.js · CC BY-SA 4.0
   Sonido automático, fundidos, mapa con adelanto, panorámicas, ensamble y tarjeta. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = { get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };

  var silencio = store.get('silencio') === '1';
  var desbloqueado = false;
  var SIL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  var master = new Audio();
  master.preload = 'auto';
  var fadeT = null, fadeVol = 1;

  function fundir(a, hasta, ms, fin) {
    clearInterval(fadeT);
    var desde = a.volume, t0 = Date.now();
    fadeT = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, desde + (hasta - desde) * k));
      if (k >= 1) { clearInterval(fadeT); if (fin) fin(); }
    }, 40);
  }

  function desbloquear() {
    if (desbloqueado) return;
    desbloqueado = true;
    document.body.classList.add('sonido-activo');
    try { master.src = SIL; master.play().catch(function () {}); } catch (e) {}
    reproducirNodo();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, desbloquear, { once: true, passive: true }); });

  /* ---------- botón de silencio ---------- */
  var btnSon = $('#btn-sonido');
  function pintarSon() {
    btnSon.textContent = silencio ? '🔇' : '🔊';
    btnSon.setAttribute('aria-pressed', silencio ? 'true' : 'false');
    btnSon.setAttribute('aria-label', silencio ? 'Activar sonido' : 'Silenciar sonido');
    master.muted = silencio;
    $$('video').forEach(function (v) { v.muted = silencio; });
  }
  btnSon.addEventListener('click', function (e) {
    e.stopPropagation();
    silencio = !silencio; store.set('silencio', silencio ? '1' : '0'); pintarSon();
    if (!silencio) { desbloquear(); reproducirNodo(); }
  });
  var act = $('#activar-sonido');
  if (act) act.addEventListener('click', function () { silencio = false; store.set('silencio', '0'); pintarSon(); desbloquear(); document.body.classList.add('sonido-activo'); });

  /* ---------- nodo actual ---------- */
  function nodoActual() {
    var h = location.hash.slice(1);
    var el = h && document.getElementById(h);
    if (el && el.classList.contains('nodo')) return el;
    return $('#portada');
  }
  var claveActual = null, prevBox = null;

  function marcar(box, estado) { if (box) { box.classList.toggle('sonando', estado === 'on'); box.classList.toggle('pendiente', estado === 'pend'); } }

  function sonar(src, loop, box) {
    if (!src) return;
    master.loop = !!loop;
    var abs = new URL(src, location.href).href;
    var arrancar = function () {
      master.src = abs; master.volume = 0; master.muted = silencio;
      var p = master.play();
      if (p && p.catch) p.catch(function () { marcar(box, 'pend'); });
      marcar(box, silencio ? 'off' : 'on');
      fundir(master, 1, 700);
    };
    if (!master.paused && master.src && master.src !== SIL) fundir(master, 0, 350, arrancar); else arrancar();
  }
  function parar() { if (!master.paused) fundir(master, 0, 350, function () { master.pause(); }); }

  /* clips según las elecciones */
  function val(n) { var r = $('input[name="' + n + '"]:checked'); return r ? r.id : ''; }

  function reproducirNodo() {
    if (!desbloqueado) return;
    var nodo = nodoActual();
    $$('video').forEach(function (v) { if (!nodo.contains(v)) { v.pause(); } });
    marcar(prevBox, 'off'); prevBox = null;
    var video = $('video[data-autoplay]', nodo);
    var box = $('[data-audio-box]', nodo);
    if (video) {
      parar(); jugarVideo(video);
      return;
    }
    if (box) {
      var au = $('audio[data-node-audio]', box);
      var src = au && $('source', au).getAttribute('src');
      prevBox = $('.visual', box) || box;
      var cont = box.classList.contains('media-pano') ? box : box;
      cont.dataset.src = src;
      var tgt = $('.visual', box) || box;
      sonar(src, au.hasAttribute('data-loop'), tgt);
      barraProgreso(box);
      return;
    }
    parar();
  }

  /* video: arranca solo; si el navegador bloquea el sonido, arranca mudo y ofrece activarlo */
  function quitarBoton(v) { var f = v.closest('figure'); var b = f && f.querySelector('.video-sonido'); if (b) b.remove(); }
  function jugarVideo(v) {
    quitarBoton(v);
    try { v.currentTime = 0; } catch (e) {}
    v.muted = silencio;
    var intento = v.play();
    var ponerBoton = function () {
      v.muted = true;
      var q = v.play(); if (q && q.catch) q.catch(function () {});
      if (silencio) return;
      var f = v.closest('figure'); if (!f || f.querySelector('.video-sonido')) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'video-sonido'; b.textContent = '🔊 Activar sonido';
      b.addEventListener('click', function () { v.muted = false; v.play().catch(function () {}); b.remove(); });
      f.insertBefore(b, f.firstChild);
    };
    if (intento && intento.catch) intento.catch(ponerBoton);
    // si por algún motivo no avanzó, reintentar mudo
    setTimeout(function () { if (v.paused && !v.ended && nodoActual().contains(v)) ponerBoton(); }, 1200);
  }

  function barraProgreso(box) {
    var span = $('.aud-barra span', box), bp = $('.aud-play', box), br = $('.aud-replay', box);
    if (!span) return;
    master.ontimeupdate = function () { if (master.duration) span.style.width = (100 * master.currentTime / master.duration) + '%'; };
    master.onended = function () { bp.textContent = '▶'; };
    bp.onclick = function () { if (master.paused) { master.play(); bp.textContent = '⏸'; } else { master.pause(); bp.textContent = '▶'; } };
    br.onclick = function () { master.currentTime = 0; master.play(); bp.textContent = '⏸'; };
    bp.textContent = '⏸';
  }

  /* botón "Tocá para escuchar" (si el navegador bloqueó el autoplay) */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tocar');
    if (!t) return;
    desbloqueado = true; silencio = false; store.set('silencio', '0'); pintarSon();
    var box = t.closest('[data-audio-box]');
    master.play().catch(function () {}); marcar(t.closest('.visual'), 'on');
    if (!master.src || master.src === SIL) reproducirNodo();
  });

  function alCambiarRuta() {
    var h = location.hash;
    fundirSalida();
    window.scrollTo(0, 0);
    reproducirNodo();
    if (!desbloqueado) { /* esperando el primer toque */ }
    actualizarModal();
  }
  function fundirSalida() { /* el siguiente sonar() hace el fundido */ }
  window.addEventListener('hashchange', alCambiarRuta);

  /* ---------- teclado ← → ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.target.matches('textarea,input[type=text]')) return;
    if (e.target.closest && e.target.closest('.panor-vista')) return;
    if (e.key === 'Escape') { cerrarModal(); return; }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var nodo = nodoActual();
    var sel = e.key === 'ArrowRight' ? '.acciones a.btn:not(.btn-sec):not([hidden])' : '.acciones a.btn-sec';
    var cand = $$(sel, nodo).filter(function (a) { return a.offsetParent !== null; });
    if (cand.length) { e.preventDefault(); location.hash = cand[0].getAttribute('href'); }
  });

  /* soltar el foco de los radios para poder usar las flechas */
  document.addEventListener('change', function (e) { if (e.target.matches('.opcion')) e.target.blur(); });

  /* ---------- reiniciar elecciones ---------- */
  document.addEventListener('click', function (e) {
    var r = e.target.closest && e.target.closest('[data-reset]');
    if (r) { $$('.opcion').forEach(function (i) { i.checked = false; }); var ta = $('#tarjeta-texto'); if (ta) ta.value = ''; $$('.ens-pieza').forEach(function (b) { b.classList.remove('lista'); }); }
  });

  /* ---------- panorámicas ---------- */
  $$('.media-pano').forEach(function (box) {
    var v = $('.panor-vista', box), l = $('.izq', box), d = $('.der', box);
    var paso = function () { return Math.max(200, v.clientWidth * 0.6); };
    l.addEventListener('click', function () { v.scrollBy({ left: -paso(), behavior: 'smooth' }); });
    d.addEventListener('click', function () { v.scrollBy({ left: paso(), behavior: 'smooth' }); });
    v.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') { v.scrollBy({ left: -120 }); e.preventDefault(); } if (e.key === 'ArrowRight') { v.scrollBy({ left: 120 }); e.preventDefault(); } });
    var down = false, sx = 0, sl = 0, moved = false;
    v.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.target.closest('summary')) return; down = true; moved = false; sx = e.clientX; sl = v.scrollLeft; });
    window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 3) moved = true; v.scrollLeft = sl - dx; });
    window.addEventListener('pointerup', function () { down = false; });
    $$('.punto', box).forEach(function (p) { p.addEventListener('toggle', function () { if (p.open) $$('.punto', box).forEach(function (o) { if (o !== p) o.open = false; }); }); });
    // centrar la vista al entrar
    setTimeout(function () { v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2; }, 50);
  });

  /* ---------- portada: mapa con adelanto sonoro ---------- */
  var tactil = window.matchMedia('(hover: none)').matches;
  var prev = new Audio(); prev.preload = 'none';
  var tPrev = null, zonaAct = null;
  var info = $('#etapa-activa');
  function adelanto(z) {
    if (zonaAct === z) return;
    cortarAdelanto();
    zonaAct = z; z.classList.add('activa');
    if (info) info.textContent = z.dataset.nombre || '';
    if (!desbloqueado || silencio) return;
    prev.src = z.dataset.audio; prev.volume = 0.0; prev.currentTime = 0;
    var p = prev.play(); if (p && p.catch) p.catch(function () {});
    var t0 = Date.now(); clearInterval(tPrev);
    tPrev = setInterval(function () {
      var s = (Date.now() - t0) / 1000;
      prev.volume = Math.max(0, Math.min(1, s < .4 ? s / .4 : s > 4.4 ? (5 - s) / .6 : 1)) * .9;
      if (s >= 5) cortarAdelanto();
    }, 50);
  }
  function cortarAdelanto() {
    clearInterval(tPrev); try { prev.pause(); } catch (e) {}
    if (zonaAct) { zonaAct.classList.remove('activa'); zonaAct = null; }
    if (info) info.textContent = '';
  }
  $$('.zona').forEach(function (z) {
    z.addEventListener('mouseenter', function () { if (!tactil) adelanto(z); });
    z.addEventListener('mouseleave', function () { if (!tactil) cortarAdelanto(); });
    z.addEventListener('focus', function () { adelanto(z); });
    z.addEventListener('blur', cortarAdelanto);
    z.addEventListener('click', function (e) {
      if (tactil && zonaAct !== z) { e.preventDefault(); desbloquear(); adelanto(z); }
      else cortarAdelanto();
    });
  });
  window.addEventListener('hashchange', cortarAdelanto);

  /* ---------- ensamble del pregón (nodo 22) ---------- */
  var CLIP = { mem: 'nodo04.mp3', rit: 'nodo11.mp3', act: 'nodo19.mp3' };
  var TXT = { 'mem-abuela': 'la paciencia de su abuela', 'mem-barrio': 'el silencio del barrio', 'rit-metal': 'el golpe metálico', 'rit-eco': 'el eco largo', 'act-cercana': 'una voz cercana', 'act-festiva': 'una voz festiva' };
  function clipDe(k) {
    if (k === 'rit') return val('rit') === 'rit-eco' ? 'nodo13.mp3' : 'nodo11.mp3';
    if (k === 'act') return val('act') === 'act-festiva' ? 'nodo20.mp3' : 'nodo19.mp3';
    return CLIP[k];
  }
  var ensRes = $('#ens-resultado'), listas = {};
  function textoEns() {
    var m = val('mem'), r = val('rit'), a = val('act');
    var partes = [];
    if (listas.mem) partes.push(TXT[m] || 'un recuerdo');
    if (listas.rit) partes.push(TXT[r] || 'un ritmo');
    if (listas.act) partes.push(TXT[a] || 'una actitud');
    if (!partes.length) return 'Tocá cada pieza: suena y se suma al pregón.';
    return 'Mi pregón lleva ' + partes.join(', ').replace(/, ([^,]*)$/, ' y $1') + '.';
  }
  $$('.ens-pieza').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.pieza;
      listas[k] = true; b.classList.add('lista');
      var slot = $('[data-slot="' + k + '"]', b), v = val(k);
      slot.textContent = TXT[v] || '(no elegiste: se suma igual)';
      if (ensRes) ensRes.textContent = textoEns();
      desbloquear();
      if (!silencio) { master.loop = false; fundir(master, 0, 150, function () { master.src = clipDe(k); master.muted = false; master.volume = 1; master.onended = function () { reproducirNodo(); }; master.play().catch(function () {}); }); }
    });
  });
  var todo = $('#ens-todo');
  if (todo) todo.addEventListener('click', function () {
    desbloquear();
    ['mem', 'rit', 'act'].forEach(function (k) { listas[k] = true; var b = $('[data-pieza="' + k + '"]'); b.classList.add('lista'); $('[data-slot="' + k + '"]', b).textContent = TXT[val(k)] || '(sin elegir)'; });
    if (ensRes) ensRes.textContent = textoEns();
    if (silencio) return;
    var cola = ['mem', 'rit', 'act'], i = 0;
    master.loop = false;
    function sig() { if (i >= cola.length) { master.onended = null; return; } master.src = clipDe(cola[i++]); master.muted = false; master.volume = 1; master.play().catch(function () {}); setTimeout(function () { if (i < cola.length && !master.paused) { master.pause(); sig(); } else if (i >= cola.length) { /* deja terminar */ } }, 5000); }
    sig();
  });

  /* ---------- tarjeta compartible (nodo 26) ---------- */
  var cv = $('#tarjeta-canvas');
  if (cv) {
    var ctx = cv.getContext('2d'), ta = $('#tarjeta-texto'), dl = $('#tarjeta-descargar');
    var ajustar = function (t, x, y, w, lh) {
      var pal = t.split(/\s+/), lin = '', ys = y;
      pal.forEach(function (p) { var t2 = lin ? lin + ' ' + p : p; if (ctx.measureText(t2).width > w && lin) { ctx.fillText(lin, x, ys); lin = p; ys += lh; } else lin = t2; });
      ctx.fillText(lin, x, ys); return ys;
    };
    var dibujar = function () {
      var g = ctx.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#E5C158'); g.addColorStop(1, '#C9704A');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1350);
      ctx.fillStyle = '#3A2535'; ctx.fillRect(60, 60, 960, 1230);
      ctx.fillStyle = '#FDFBF7'; ctx.fillRect(80, 80, 920, 1190);
      ctx.fillStyle = '#3A2535'; ctx.textAlign = 'center';
      ctx.font = '700 40px Montserrat, sans-serif'; ctx.fillText('MI PRIMER PREGÓN', 540, 190);
      ctx.font = '700 120px Caveat, cursive';
      var txt = (ta.value || '').trim() || 'Acá va tu pregón…';
      ctx.font = '700 84px Caveat, cursive';
      var fin = ajustar('“' + txt + '”', 540, 400, 780, 100);
      var pal = { 'pal-ternura': 'Ternura', 'pal-orgullo': 'Orgullo', 'pal-alegria': 'Alegría', 'pal-valentia': 'Valentía' }[val('pal')];
      if (pal) { ctx.font = '600 38px Montserrat, sans-serif'; ctx.fillStyle = '#1E4D6B'; ctx.fillText('CORAZÓN: ' + pal.toUpperCase(), 540, Math.max(fin + 140, 900)); }
      ctx.fillStyle = '#3A2535'; ctx.font = '700 70px Caveat, cursive'; ctx.fillText('El eco del pregón', 540, 1150);
      ctx.font = '600 34px Montserrat, sans-serif'; ctx.fillText('@eco.del.pregon', 540, 1210);
      try { dl.href = cv.toDataURL('image/png'); } catch (e) {}
    };
    var cr = $('#tarjeta-crear');
    cr.addEventListener('click', dibujar);
    ta.addEventListener('input', dibujar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(dibujar); else dibujar();
    window.addEventListener('hashchange', function () { if (location.hash === '#nodo26') dibujar(); });
  }

  /* ---------- modal "Estás aquí" ---------- */
  var modal = $('#modal-mapa');
  var NP = { 1: 'a', 2: 'a', 3: 'b', 4: 'c', 5: 'c', 6: 'c', 7: 'c', 8: 'd', 9: 'e', 10: 'e', 11: 'f', 12: 'f', 13: 'f', 14: 'g', 15: 'g', 16: 'g', 17: 'h', 18: 'i', 19: 'i', 20: 'i', 21: 'j', 23: 'j', 22: 'k', 24: 'k', 25: 'k', 26: 'l', 27: 'l' };
  var PP = { a: [82.0, 12.3, 16.1, 6.1], b: [69.3, 25.9, 8.5, 4.0], c: [84.3, 31.6, 13.8, 6.1], d: [85.7, 44.3, 11.8, 4.4], e: [61.2, 48.2, 14.1, 6.3], f: [66.5, 56.9, 15.7, 6.2], g: [71.5, 65.4, 17.5, 6.2], h: [3.8, 45.6, 18.4, 7.1], i: [20.3, 55.6, 15.3, 7.2], j: [4.0, 90.3, 14.0, 6.0], k: [20.6, 90.3, 15.3, 6.0], l: [86.3, 89.3, 10.5, 6.2] };
  function abrirModal() {
    var n = parseInt((location.hash.match(/nodo(\d+)/) || [])[1], 10);
    var pin = $('#pin'), donde = $('#donde');
    var z = NP[n] && PP[NP[n]];
    if (z) { pin.hidden = false; pin.style.left = z[0] + '%'; pin.style.top = z[1] + '%'; pin.style.width = z[2] + '%'; pin.style.height = z[3] + '%'; var h1 = $('h1', nodoActual()); donde.textContent = 'Estás aquí: ' + (h1 ? h1.textContent : 'nodo ' + n); }
    else { pin.hidden = true; donde.textContent = 'Recorrido completo de la jornada.'; }
    modal.hidden = false; $('#cerrar-mapa').focus();
    var sc = $('#modal-scroll'); if (z && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (z[0] / 100) * sc.scrollWidth - sc.clientWidth / 2;
  }
  function cerrarModal() { if (modal) modal.hidden = true; }
  function actualizarModal() { cerrarModal(); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.btn-mapa');
    if (a) { e.preventDefault(); abrirModal(); }
    if (e.target === modal) cerrarModal();
  });
  $('#cerrar-mapa').addEventListener('click', cerrarModal);

  /* ---------- inicio ---------- */
  pintarSon();
  if (silencio) { /* respeta la elección */ }
  window.addEventListener('load', function () { reproducirNodo(); });
})();

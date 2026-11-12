'use strict';
const VERSAO = 'v7';
// ---------- Dados do inventário (PDF BP 2026, 31 itens) ----------
// [nº, plaqueta (7 dígitos), nº novo, descrição, sala cadastrada, tipo]
const ITENS = [
  [1,'6108699','','Receptor GNSS-RTK','SL.10','gnss'],
  [2,'6108458','','Receptor GNSS-RTK','LAB.AUTOMAÇÃO','gnss'],
  [3,'6108459','','Receptor GNSS-RTK','LAB.AUTOMAÇÃO','gnss'],
  [4,'6108479','100060015031','Gerador a gasolina (inverter)','SL.10','outros'],
  [5,'6107149','100150046263','Monitor LED E2314H','SL.02','mon'],
  [6,'6107449','100150046404','HD externo USB 3.0','SL.03','outros'],
  [7,'6107813','100150050926','Desktop 8 cores, 32 GB','SL.03','pc'],
  [8,'6107826','100150050939','Notebook','SL.03','pc'],
  [9,'6107622','100150050394','Monitor curvo 34"','SL.03','mon'],
  [10,'6107743','100150050851','Tablet Samsung Galaxy 11"','SL.03','pc'],
  [11,'6108419','100150054344','Desktop HP EliteDesk 800 G6','SL.10','pc'],
  [12,'6106711','100150030926','Monitor LCD EA53V','SL.10','mon'],
  [13,'6108429','100150054354','Monitor LED AOC 24P1U','SL.10','mon'],
  [14,'6108486','100010014572','Roteador Dragino LoRaWAN DLOS8N','LAB.AUTOMAÇÃO','rede'],
  [15,'6108686','100010014943','Dragino LoRaWAN LHT65S-E3','LAB.AUTOMAÇÃO','rede'],
  [16,'6109021','100150065125','Desktop Positivo Master C840','LAB.AUTOMAÇÃO','pc'],
  [17,'6109023','100150065127','Monitor Positivo 23,8"','LAB.AUTOMAÇÃO','mon'],
  [18,'6106950','100180069815','Armário alto MDP branco','SL.03','movel'],
  [19,'6106964','100180069828','Armário baixo MDF, portas de correr','SL.03','movel'],
  [20,'6107127','','Módulo de trabalho (mesa)','SL.03','movel'],
  [21,'6106842','100180069727','Gaveteiro volante','SL.03','movel'],
  [22,'6107039','100180069895','Poltrona fixa aço inox','SL.03','assento'],
  [23,'6107036','100180069896','Poltrona fixa aço inox','SL.03','assento'],
  [24,'6106947','100180069813','Poltrona giratória com braços','SL.03','assento'],
  [25,'6108408','100180139589','Cadeira dobrável de camping','SL.10','assento'],
  [26,'6108409','100180139590','Cadeira dobrável de camping','SL.10','assento'],
  [27,'6108406','100180139587','Mesa dobrável Mor 3411','SL.10','movel'],
  [28,'6108407','100180139588','Mesa dobrável Mor 3411','SL.10','movel'],
  [29,'6108478','100200007226','Câmera de profundidade RGB-D','SL.10','outros'],
  [30,'6108480','100200007227','Monitor de campo 7" Feelworld','SL.10','mon'],
  [31,'6108681','100240000095','Drone com sensor multiespectral','SL.10','outros'],
].map(([n,c,novo,d,s,t]) => ({n,c,novo,d,s,t}));

const SALAS = ['SL.02','SL.03','SL.10','LAB.AUTOMAÇÃO'];
// tipo: [plural, "todos os/todas as"]
const TIPOS = {
  mon:['Monitores','Todos os'], pc:['Computadores e tablet','Todos os'],
  gnss:['Receptores GNSS','Todos os'], rede:['Roteadores LoRaWAN','Todos os'],
  outros:['Outros equipamentos','Todos os'], movel:['Armários e mesas','Todos os'],
  assento:['Cadeiras e poltronas','Todas as'],
};
const plq = c => c + '-000';

// ---------- Estado (fica só neste aparelho) ----------
const KEY = 'inventario-bp2026-v1';
let st = { found:{}, extras:[], leitor:'auto' };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.found) st = s; } catch (e) {}
const LEITORES = { auto:'Automático (nativo, depois ZXing C++)', nativo:'Nativo do Android', wasm:'ZXing C++ (WebAssembly)', js:'ZXing JavaScript' };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

let view = { name:'home', sala:null, tipo:null };
let flash = null, bannerShown = false;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const isFound = it => !!st.found[it.c];
const cnt = list => list.filter(isFound).length + ' de ' + list.length;
const badge = list => `<span class="count ${list.every(isFound)?'done':''}">${list.every(isFound)?'✓ ':''}${cnt(list)}</span>`;

function go(name, sala, tipo) {
  stopCam();
  view = { name, sala: sala ?? view.sala, tipo: tipo ?? view.tipo };
  flash = null; bannerShown = false;
  render(); window.scrollTo(0,0);
}

// ---------- Telas ----------
function render() {
  $('back').hidden = view.name === 'home';
  $('rep').hidden = view.name === 'report';
  const app = $('app');
  if (view.name === 'home') {
    $('title').innerHTML = 'Inventário BP 2026<small>Escolha a sala onde você está · ' + VERSAO + '</small>';
    const f = ITENS.filter(isFound).length;
    app.innerHTML = `
      <div class="total"><b>${f}</b><span>de ${ITENS.length} bens encontrados</span></div>
      <div class="bar"><i style="width:${100*f/ITENS.length}%"></i></div>
      <h2>Salas</h2>
      <div class="pick">${SALAS.map(s => { const l = ITENS.filter(i => i.s === s);
        return `<button data-sala="${esc(s)}"><span>${esc(s)}<small>${l.length} ${l.length>1?'bens cadastrados':'bem cadastrado'} aqui</small></span>${badge(l)}</button>`; }).join('')}</div>`;
  } else if (view.name === 'scan') {
    $('title').innerHTML = `${esc(view.sala)}<small>Leia todas as plaquetas da sala</small>`;
    app.innerHTML = `
      <div class="cam"><video id="video" playsinline muted></video><div class="guide"></div>
        <div class="msg" id="cammsg">Abrindo a câmera…</div>
        <div class="camctl"><button id="lens" hidden>Lente</button><button id="zoom" hidden>Zoom</button><button id="torch" hidden>Lanterna</button></div></div>
      <label class="leitor">Leitor <select id="leitor">${Object.entries(LEITORES).map(([k, v]) => `<option value="${k}" ${(st.leitor || 'auto') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <p class="note" id="diag"></p>
      <div id="flash"></div><div id="banner"></div>
      <form class="manual" id="manual"><input id="code" inputmode="numeric" autocomplete="off" placeholder="Ou digite a plaqueta (7 dígitos)" aria-label="Número da plaqueta">
        <button class="btn" type="submit">OK</button></form>
      <div id="lists"></div>`;
    renderScan(); startCam();
  } else {
    $('title').innerHTML = 'Relatório<small>Resultado da conferência</small>';
    const row = it => { const f = st.found[it.c];
      return `<li class="${f?'found':''}"><div><span class="plq">${plq(it.c)}</span> <span class="d">${esc(it.d)}</span>
        <div class="x">${f ? (f.sala === it.s ? '✓ Na sala cadastrada (' + esc(it.s) + ')' : '✓ Achado em ' + esc(f.sala) + ' — cadastro diz ' + esc(it.s))
          : 'Não encontrado — cadastro: ' + esc(it.s)}</div></div></li>`; };
    app.innerHTML = `
      <div class="total"><b>${ITENS.filter(isFound).length}</b><span>de ${ITENS.length} bens encontrados</span></div>
      <div class="row"><button class="btn" id="share">Compartilhar</button><button class="btn ghost" id="copy">Copiar texto</button>
        <button class="btn ghost" id="csv">Baixar CSV</button></div>
      <p class="note" id="repmsg"></p>
      <h2>Na sala errada</h2><ul class="items">${ITENS.filter(i => isFound(i) && st.found[i.c].sala !== i.s).map(row).join('') || '<li><div>Nenhum bem achado fora da sala cadastrada.</div></li>'}</ul>
      <h2>Não encontrados</h2><ul class="items">${ITENS.filter(i => !isFound(i)).map(row).join('') || '<li><div>Nenhum. Todos os bens foram encontrados.</div></li>'}</ul>
      <h2>Encontrados</h2><ul class="items">${ITENS.filter(isFound).map(row).join('') || '<li><div>Nenhum bem lido ainda.</div></li>'}</ul>
      <h2>Plaquetas lidas que não são suas</h2><ul class="items">${st.extras.map(e => `<li><div><span class="plq">${esc(e.code)}</span><div class="x">lida em ${esc(e.sala)}</div></div></li>`).join('') || '<li><div>Nenhuma.</div></li>'}</ul>
      <h2>Recomeçar</h2><div class="row"><button class="btn danger" id="reset">Apagar toda a conferência</button></div>`;
  }
}

function renderScan() {
  const alvo = ITENS.filter(i => i.s === view.sala);
  const fl = flash || { k:'idle', t:'Leitura contínua: encaixe o código de barras inteiro dentro da moldura vermelha, ocupando quase toda a largura dela.', s:'' };
  $('flash').innerHTML = `<div class="flash ${fl.k}" role="status">${esc(fl.t)}${fl.s?`<small>${esc(fl.s)}</small>`:''}</div>`;
  const done = alvo.every(isFound);
  $('banner').innerHTML = done ? `<div class="doneBanner"><strong>Todos os ${alvo.length} bens cadastrados em ${esc(view.sala)} foram encontrados.</strong>
    <button id="next">Escolher outra sala</button></div>` : '';
  if (done && !bannerShown) { bannerShown = true; buzz([120,80,120,80,300]); }
  if (!done) bannerShown = false;
  const li = it => { const f = st.found[it.c];
    return `<li class="${f?'found':''}"><div><span class="plq">${plq(it.c)}</span><div class="d">${esc(it.d)}</div>
      ${f ? `<div class="x">✓ achado em ${esc(f.sala)}${f.manual?' (digitado)':''}</div>` : ''}</div>
      ${f ? `<button data-undo="${it.c}">Desfazer</button>` : ''}</li>`; };
  const tipos = Object.keys(TIPOS).filter(t => alvo.some(i => i.t === t));
  // um selo por tipo: o que falta nesta sala e o que falta nas outras (pode estar aqui, na sala errada)
  const chips = Object.keys(TIPOS).map(t => {
    const aqui = alvo.filter(i => i.t === t && !isFound(i)).length;
    const fora = ITENS.filter(i => i.t === t && i.s !== view.sala && !isFound(i)).length;
    if (!aqui && !fora) return `<span class="chip done">✓ ${TIPOS[t][0]} · todos encontrados, pode parar de ler</span>`;
    if (!aqui) return `<span class="chip mid">${TIPOS[t][0]} · nenhum falta aqui · ${fora} em outras salas</span>`;
    return `<span class="chip">${TIPOS[t][0]} · ${aqui > 1 ? 'faltam' : 'falta'} ${aqui} aqui${fora ? ' · ' + fora + ' em outras salas' : ''}</span>`; }).join('');
  const pend = tipos.filter(t => alvo.some(i => i.t === t && !isFound(i))).map(t => { const l = alvo.filter(i => i.t === t);
    return `<h3>${TIPOS[t][0]} — ${cnt(l)}</h3><ul class="items">${l.filter(i => !isFound(i)).map(li).join('')}</ul>`; }).join('');
  const achados = ITENS.filter(i => isFound(i) && (i.s === view.sala || st.found[i.c].sala === view.sala));
  const fora = ITENS.filter(i => i.s !== view.sala && !isFound(i));
  const alheias = st.extras.filter(e => e.sala === view.sala);
  $('lists').innerHTML = `
    <h2>Falta encontrar em ${esc(view.sala)} — ${alvo.length - alvo.filter(isFound).length} de ${alvo.length}</h2>
    <div class="chips">${chips}</div>
    ${pend || '<p class="note">Nada pendente nesta sala.</p>'}
    <h2>Já encontrados nesta sala — ${achados.length}</h2>
    <ul class="items">${achados.map(li).join('') || '<li><div>Nenhum ainda.</div></li>'}</ul>
    <details><summary>Plaquetas lidas aqui que não são suas — ${alheias.length}</summary><ul class="items">${alheias.map(e =>
      `<li><div><span class="plq">${esc(e.code)}</span></div></li>`).join('') || '<li><div>Nenhuma.</div></li>'}</ul></details>
    ${fora.length ? `<details><summary>Cadastrados em outras salas, ainda não achados — ${fora.length}</summary><ul class="items">${fora.map(it =>
      `<li><div><span class="plq">${plq(it.c)}</span><div class="d">${esc(it.d)}</div><div class="x">${TIPOS[it.t][0]} · cadastro: ${esc(it.s)}</div></div></li>`).join('')}</ul></details>` : ''}`;
}

// ---------- Leitura ----------
let last = { d:'', t:0 }, cand = '';
function onRead(raw, manual) {
  if (view.name !== 'scan') return;
  const d = String(raw).replace(/\D/g, '');
  if (d.length < 7) { if (manual) { flash = { k:'warn', t:'Digite os 7 primeiros números da plaqueta.' }; renderScan(); } return; }
  const it = ITENS.find(i => d.startsWith(i.c)) || ITENS.find(i => d.includes(i.c));
  const now = Date.now();
  if (!manual) {
    if (d === last.d && now - last.t < 3000) return;
    if (!it && d !== cand) { cand = d; return; }   // código desconhecido: exige duas leituras iguais
    last = { d, t: now };
  }
  cand = '';
  if (!it) {
    const code = d.slice(0,7) + (d.length > 7 ? '-' + d.slice(7) : '');
    const ja = st.extras.find(e => e.code === code && e.sala === view.sala);
    if (ja) ja.n = (ja.n || 1) + 1; else st.extras.push({ code, raw: String(raw).slice(0, 40), sala: view.sala, ts: now, n: 1 });
    save();
    flash = { k:'bad', t:'Não está na sua lista', s:'Plaqueta ' + code };
    buzz([40]); SOM.alheio();
  } else if (isFound(it)) {
    flash = { k:'warn', t:'Já conferido (é seu): ' + it.d, s: plq(it.c) + ' — achado em ' + st.found[it.c].sala + '. Deve estar com etiqueta.' };
    buzz([40,60,40]); SOM.repetido();
  } else {
    st.found[it.c] = { sala: view.sala, ts: now, manual: !!manual }; save();
    const grupo = ITENS.filter(i => i.s === it.s && i.t === it.t), sala = ITENS.filter(i => i.s === view.sala);
    const nome = TIPOS[it.t][0].toLowerCase();
    let extra = '';
    if (it.s === view.sala) {
      if (sala.every(isFound)) extra = ' Sala completa!';
      else if (grupo.every(isFound)) extra = ' ' + TIPOS[it.t][1] + ' ' + nome + ' desta sala foram encontrados.';
      else { const n = grupo.filter(i => !isFound(i)).length; extra = (n > 1 ? ' Faltam ' : ' Falta ') + n + ' em ' + nome + '.'; }
      flash = { k:'ok', t:'É SEU — cole a etiqueta', s: it.d + ' · ' + plq(it.c) + '.' + extra };
    } else {
      flash = { k:'info', t:'É SEU — cole a etiqueta',
        s: it.d + ' · ' + plq(it.c) + ' — o cadastro diz ' + it.s + '. Registrado como achado em ' + view.sala + '.' };
    }
    const todoTipo = ITENS.filter(i => i.t === it.t);
    if (todoTipo.every(isFound)) flash.s += ' ' + TIPOS[it.t][1] + ' ' + todoTipo.length + ' ' + nome + ' da sua lista foram encontrados: pode parar de ler ' + nome + '.';
    if (todoTipo.every(isFound) || (it.s === view.sala && grupo.every(isFound))) setTimeout(SOM.grupo, 800);
    buzz([200,80,200]); SOM.meu();
  }
  renderScan();
}

const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
let actx;
function audioOn() {   // o navegador só libera som depois de um toque na tela
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {}
}
// notas: [[frequência Hz, duração s], ...] tocadas em sequência
function tocar(notas, tipo) {
  try { audioOn(); let t = actx.currentTime;
    notas.forEach(([f, d]) => { const o = actx.createOscillator(), g = actx.createGain();
      o.type = tipo || 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(.6, t); g.gain.setValueAtTime(.6, t + d - .02); g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d); t += d + .03; });
  } catch (e) {}
}
const SOM = {
  meu:    () => tocar([[880,.14],[1175,.14],[1568,.3]]),          // três notas subindo: É SEU, cole a etiqueta
  repetido: () => tocar([[660,.08],[660,.08]], 'sine'),           // dois toques curtos: já conferido
  alheio: () => tocar([[160,.22]], 'sine'),                       // um toque grave: não é seu
  grupo:  () => tocar([[784,.15],[988,.15],[1175,.15],[1568,.5]]) // fanfarra: grupo completo
};

// ---------- Câmera ----------
let stream = null, timer = null, detector = null, zx = null, canvas = null;
let camIds = [], camIdx = -1, zoomLv = 2, frames = 0, lastRaw = '', lastErr = '', camInfo = '', lastBy = '', wasmOk = false;
const FORMATOS = ['code_128','code_39','code_93','itf','codabar','ean_13','qr_code','data_matrix'];
function showDiag() {
  const d = $('diag'); if (!d) return;
  d.textContent = VERSAO + ' · ' + camInfo + ' · disponíveis: ' + [detector && 'nativo', wasmOk && 'C++', zx && 'JS'].filter(Boolean).join(', ') + ' · lido por: ' + (lastBy || '—') +
    ' · quadros ' + frames + (lastRaw ? ' · último lido: ' + lastRaw : ' · nada lido ainda') + (lastErr ? ' · erro: ' + lastErr : '');
}
async function startCam() {
  const msg = $('cammsg');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'Câmera indisponível. O app precisa ser aberto por HTTPS. Use o campo abaixo para digitar a plaqueta.'; return; }
  const video = { width:{ ideal:3840 }, height:{ ideal:2160 } };
  if (camIdx >= 0 && camIds[camIdx]) video.deviceId = { exact: camIds[camIdx] }; else video.facingMode = { ideal:'environment' };
  try { stream = await navigator.mediaDevices.getUserMedia({ audio:false, video }); }
  catch (e) {
    msg.hidden = false;
    msg.textContent = e && e.name === 'NotAllowedError' ? 'Permita o uso da câmera nas configurações do navegador, ou digite a plaqueta abaixo.'
      : 'Não consegui abrir a câmera. Digite a plaqueta abaixo.'; return; }
  const v = $('video');
  if (!v || view.name !== 'scan') { stopCam(); return; }
  v.srcObject = stream; msg.hidden = true;
  v.play().catch(() => {});
  const track = stream.getVideoTracks()[0];
  let caps = {};
  try { caps = track.getCapabilities ? track.getCapabilities() : {}; } catch (e) {}
  try { if (caps.focusMode && caps.focusMode.includes('continuous')) await track.applyConstraints({ advanced:[{ focusMode:'continuous' }] }); } catch (e) {}
  // zoom: deixa segurar o celular mais longe (foco melhor) com o código grande na imagem
  const bz = $('zoom');
  const setZoom = async () => { try { const z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, zoomLv));
    await track.applyConstraints({ advanced:[{ zoom:z }] }); bz.textContent = 'Zoom ' + zoomLv + '×'; } catch (e) {} };
  if (caps.zoom && caps.zoom.max > 1) { bz.hidden = false; setZoom();
    bz.onclick = () => { zoomLv = zoomLv >= 4 || zoomLv >= caps.zoom.max ? 1 : zoomLv + 1; setZoom(); }; }
  if (caps.torch) { const b = $('torch'); b.hidden = false; let on = false;
    b.onclick = () => { on = !on; track.applyConstraints({ advanced:[{ torch:on }] }).catch(()=>{}); }; }
  // lista de câmeras traseiras, para poder trocar de lente
  try { const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    const back = devs.filter(d => /back|traseira|environment|rear/i.test(d.label));
    camIds = (back.length ? back : devs).map(d => d.deviceId);
    const cur = track.getSettings ? track.getSettings().deviceId : null;
    if (camIdx < 0) camIdx = Math.max(0, camIds.indexOf(cur));
    const bl = $('lens');
    if (camIds.length > 1) { bl.hidden = false; bl.textContent = 'Lente ' + (camIdx + 1) + '/' + camIds.length;
      bl.onclick = () => { camIdx = (camIdx + 1) % camIds.length; stopCam(); startCam(); }; }
  } catch (e) {}
  const set = track.getSettings ? track.getSettings() : {};
  camInfo = 'câmera ' + (set.width || '?') + '×' + (set.height || '?');
  if (!detector && 'BarcodeDetector' in window) {
    try { const sup = await BarcodeDetector.getSupportedFormats(); const f = FORMATOS.filter(x => sup.includes(x));
      if (f.length) detector = new BarcodeDetector({ formats:f }); } catch (e) { lastErr = 'nativo: ' + (e.message || e.name); }
  }
  if (!zx && window.ZXing) {
    const Z = window.ZXing, hints = new Map();
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_93, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODABAR, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.QR_CODE]);
    zx = { Z, reader: new Z.MultiFormatReader(), hints };
  }
  if (!wasmOk && window.ZXingWASM) {
    try { ZXingWASM.prepareZXingModule({ overrides:{ locateFile:(path) => 'vendor/' + path } }); wasmOk = true; } catch (e) { lastErr = 'C++: ' + (e.message || e.name); }
  }
  canvas = canvas || document.createElement('canvas');
  showDiag();
  if (!detector && !zx && !wasmOk) { msg.hidden = false; msg.textContent = 'Leitor de código de barras indisponível neste navegador. Digite a plaqueta abaixo.'; return; }
  clearTimeout(timer); tick();
}
function got(text, by) { lastRaw = String(text).slice(0, 24); lastBy = by || ''; onRead(text, false); }
// Três recortes do quadro, um por vez: moldura (60% da largura), quadro largo (90%) e miolo ampliado (35%).
// O ZXing só decodifica quando o código ocupa cerca de metade ou mais da largura analisada.
const PASSES = [{ f:.6, up:1 }, { f:.9, up:1 }, { f:.35, up:2 }];
function recorte(src, vw, vh, p, cv) {
  const sw = Math.round(vw * p.f), sh = Math.round(Math.min(vh * .5, sw * .45)), sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
  const w = Math.max(1000, Math.min(2000, sw * p.up));
  cv.width = w; cv.height = Math.round(sh * w / sw);
  const ctx = cv.getContext('2d', { willReadFrequently:true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  return cv;
}
function lerZXing(cv) {
  const { Z, reader, hints } = zx, src = new Z.HTMLCanvasElementLuminanceSource(cv);
  for (const B of [Z.HybridBinarizer, Z.GlobalHistogramBinarizer]) {
    try { return reader.decode(new Z.BinaryBitmap(new B(src)), hints).getText(); } catch (e) { /* nada neste recorte */ }
  }
  return null;
}
const WASM_OPTS = { formats:['Code128','Code39','Code93','ITF','Codabar','EAN-13','QRCode','DataMatrix'], tryHarder:true, tryRotate:false, maxNumberOfSymbols:4 };
async function lerWasm(cv) {
  const img = cv.getContext('2d', { willReadFrequently:true }).getImageData(0, 0, cv.width, cv.height);
  return (await ZXingWASM.readBarcodes(img, WASM_OPTS)).map(r => r.text).filter(Boolean);
}
async function tick() {
  const v = $('video');
  if (!stream || !v) return;
  if (v.readyState >= 2 && v.videoWidth) {
    const cv = recorte(v, v.videoWidth, v.videoHeight, PASSES[frames % PASSES.length], canvas);
    frames++;
    const modo = st.leitor || 'auto';
    let ok = false;
    if (detector && (modo === 'auto' || modo === 'nativo')) {
      try { (await detector.detect(cv)).forEach(b => { ok = true; got(b.rawValue, 'nativo'); }); } catch (e) { lastErr = 'nativo: ' + (e.message || e.name); }
    }
    // sem o leitor escolhido neste aparelho, cai para o próximo disponível
    const usaWasm = wasmOk && (modo === 'wasm' || modo === 'auto' || (modo === 'nativo' && !detector));
    if (!ok && usaWasm) {
      try { (await lerWasm(cv)).forEach(t => { ok = true; got(t, 'C++'); }); } catch (e) { lastErr = 'C++: ' + (e.message || e.name || e); }
    }
    if (!ok && zx && (modo === 'js' || (!usaWasm && !(modo === 'nativo' && detector)))) {
      try { const t = lerZXing(cv); if (t) got(t, 'JS'); } catch (e) { lastErr = 'JS: ' + (e.message || e.name); }
    }
    if (frames % 5 === 0) showDiag();
  }
  timer = setTimeout(tick, 60);
}
function stopCam() {
  clearTimeout(timer); timer = null;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCam(); else if (view.name === 'scan' && !stream) { const m = $('cammsg'); if (m) { m.hidden = false; m.textContent = 'Abrindo a câmera…'; } startCam(); }
});

// ---------- Relatório ----------
function reportText() {
  const f = ITENS.filter(isFound), nf = ITENS.filter(i => !isFound(i));
  const L = ['Inventário BP 2026 — conferência', `Encontrados: ${f.length} de ${ITENS.length}`, '', 'NA SALA ERRADA'];
  const err = f.filter(i => st.found[i.c].sala !== i.s);
  err.forEach(i => L.push(`${i.n}. ${plq(i.c)} ${i.d} — achado em ${st.found[i.c].sala}, cadastro diz ${i.s}`));
  if (!err.length) L.push('nenhum');
  L.push('', 'ENCONTRADOS');
  f.forEach(i => { const s = st.found[i.c].sala; L.push(`${i.n}. ${plq(i.c)} ${i.d} — ${s === i.s ? 'na sala cadastrada ' + i.s : 'achado em ' + s + ' (cadastro: ' + i.s + ')'}`); });
  L.push('', 'NÃO ENCONTRADOS'); nf.forEach(i => L.push(`${i.n}. ${plq(i.c)} ${i.d} — cadastro: ${i.s}`));
  if (st.extras.length) { L.push('', 'PLAQUETAS LIDAS FORA DA LISTA'); st.extras.forEach(e => L.push(`${e.code} — lida em ${e.sala}`)); }
  return L.join('\n');
}
function reportCsv() {
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const rows = [['n','plaqueta','numero_novo','descricao','sala_cadastro','encontrado','sala_encontrado','digitado','quando']];
  ITENS.forEach(i => { const f = st.found[i.c];
    rows.push([i.n, plq(i.c), i.novo, i.d, i.s, f ? 'sim' : 'nao', f ? f.sala : '', f && f.manual ? 'sim' : '', f ? new Date(f.ts).toISOString() : '']); });
  st.extras.forEach(e => rows.push(['', e.code, '', 'FORA DA LISTA', '', 'sim', e.sala, '', new Date(e.ts).toISOString()]));
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
}

// ---------- Eventos ----------
let resetArmed = false;
document.addEventListener('click', async e => {
  audioOn();
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'back') return go('home');
  if (b.id === 'rep') return go('report');
  if (b.id === 'next') return go('home');
  if (b.dataset.sala) return go('scan', b.dataset.sala);
  if (b.dataset.tipo) return go('scan', null, b.dataset.tipo);
  if (b.dataset.undo) { delete st.found[b.dataset.undo]; save(); flash = { k:'warn', t:'Leitura desfeita', s: plq(b.dataset.undo) }; return renderScan(); }
  const say = t => { const m = $('repmsg'); if (m) m.textContent = t; };
  if (b.id === 'copy') { try { await navigator.clipboard.writeText(reportText()); say('Relatório copiado.'); } catch (x) { say('Não consegui copiar. Use Compartilhar ou Baixar CSV.'); } }
  if (b.id === 'share') { if (navigator.share) { try { await navigator.share({ title:'Inventário BP 2026', text: reportText() }); } catch (x) {} } else say('Este navegador não compartilha. Use Copiar texto.'); }
  if (b.id === 'csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reportCsv()], { type:'text/csv' }));
    a.download = 'inventario-bp2026.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
  if (b.id === 'reset') { if (!resetArmed) { resetArmed = true; b.textContent = 'Toque de novo para confirmar'; setTimeout(() => { resetArmed = false; if (b.isConnected) b.textContent = 'Apagar toda a conferência'; }, 4000); }
    else { resetArmed = false; st = { found:{}, extras:[], leitor: st.leitor }; save(); go('home'); } }
});
document.addEventListener('change', e => { if (e.target.id === 'leitor') { st.leitor = e.target.value; save(); lastBy = ''; showDiag(); } });
document.addEventListener('submit', e => {
  if (e.target.id !== 'manual') return; e.preventDefault();
  const i = $('code'); onRead(i.value, true); i.value = '';
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

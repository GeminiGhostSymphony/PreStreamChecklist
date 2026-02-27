/* PreStreamChecklist Engine  */
const setupHelp = { 
    mixitup: "<b>MixItUp</b>: Port 8111.", streamerbot: "<b>Streamer.bot</b>: Port 8080.", veadotube: "<b>Veadotube</b>: Port 57073.", vts: "<b>VTube Studio</b>: Port 8001.", spotify: "<b>Spotify</b>: Use Desktop App.", crowdcontrol: "<b>Crowd Control</b>: Port 58430.", sammi: "<b>SAMMI</b>: Port 9450.", voicemod: "<b>Voicemod</b>: Port 59129.", camo: "<b>Camo Studio</b>: Use Port 5555 or 8080."
};

const serviceDefs = [ 
    { key: 'mixitup', name: 'MixItUp', port: 8111 }, { key: 'streamerbot', name: 'Streamer.bot', port: 8080 }, { key: 'veadotube', name: 'Veadotube Mini', port: 57073 }, { key: 'vts', name: 'VTube Studio', port: 8001 }, { key: 'spotify', name: 'Spotify', port: 57621 }, { key: 'crowdcontrol', name: 'Crowd Control', port: 58430 }, { key: 'songify', name: 'Songify', port: 5001 }, { key: 'vbridger', name: 'VBridger', port: 8001 }, { key: 'vts-hr', name: 'vts-heartrate', port: 8001 }, { key: 'sammi', name: 'SAMMI', port: 9450 }, { key: 'voicemod', name: 'Voicemod', port: 59129 }, { key: 'camo', name: 'Camo Studio', port: 5555 }
];

const PREFIX = "ps_chk_GGS_";
let items = JSON.parse(localStorage.getItem(PREFIX+'items') || '[{"text":"Check Mic Levels","done":false}]');
let activeServices = JSON.parse(localStorage.getItem(PREFIX+'svc') || '[]');
let presets = JSON.parse(localStorage.getItem(PREFIX+'presets') || '{}');
let defaultPreset = localStorage.getItem(PREFIX+'default_preset') || "";
let instrVisible = JSON.parse(localStorage.getItem(PREFIX+'instr_vis') ?? 'true');
let autoScanEnabled = JSON.parse(localStorage.getItem(PREFIX+'auto_scan') ?? 'false');
let debugEnabled = JSON.parse(localStorage.getItem(PREFIX+'debug') ?? 'false');
let autoScanTimer = null, timeLeft = 30, isScanning = false;

const save = () => {
    localStorage.setItem(PREFIX+'items', JSON.stringify(items));
    localStorage.setItem(PREFIX+'svc', JSON.stringify(activeServices));
    localStorage.setItem(PREFIX+'presets', JSON.stringify(presets));
    localStorage.setItem(PREFIX+'default_preset', defaultPreset);
    localStorage.setItem(PREFIX+'instr_vis', JSON.stringify(instrVisible));
    localStorage.setItem(PREFIX+'auto_scan', JSON.stringify(autoScanEnabled));
    localStorage.setItem(PREFIX+'debug', JSON.stringify(debugEnabled));
};

function renderChecklist() {
    const container = document.getElementById('checklist-container'); if(!container) return;
    container.innerHTML = "";
    items.forEach((item, i) => {
        const row = document.createElement('div'); row.className = `item-row ${item.done ? 'is-done' : ''}`;
        row.draggable = true;
        row.innerHTML = `<div class="drag-handle">⠿</div><input type="checkbox" class="cb" ${item.done ? 'checked' : ''} onchange="toggleItem(${i})"><input type="text" class="item-text" value="${item.text.replace(/"/g, '&quot;')}" oninput="items[${i}].text=this.value;save()"><span style="cursor:pointer;color:var(--error);opacity:0.6;padding:0 5px;font-weight:bold;" onclick="items.splice(${i},1);renderChecklist();save()">✕</span>`;
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text', i); row.classList.add('dragging'); });
        row.addEventListener('dragend', () => { row.classList.remove('dragging'); document.querySelectorAll('.item-row').forEach(r => r.classList.remove('drag-over')); });
        row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData('text'));
            const to = i;
            const temp = items.splice(from, 1);
            items.splice(to, 0, temp);
            renderChecklist(); save();
        });
        container.appendChild(row);
    });
}

function toggleItem(i) { items[i].done = !items[i].done; renderChecklist(); save(); }
function bulkCheck(val) { items.forEach(i => i.done = val); renderChecklist(); save(); }
function addItem() { items.push({text: "New Task", done: false}); renderChecklist(); save(); }
function savePreset() { const name = document.getElementById('newPresetName').value.trim(); if (!name) return alert("Enter a name"); presets[name] = { svc: activeServices.map(s => ({...s, verified: false, lastStatus: 'Waiting'})), checklist: JSON.parse(JSON.stringify(items)) }; updatePresetDropdown(); save(); }

function loadPreset(name) {
    if (!name || !presets[name]) return;
    isScanning = false;
    activeServices = JSON.parse(JSON.stringify(presets[name].svc || [])).map(s => ({...s, verified: false, lastStatus: 'Waiting', responseTime: 0}));
    if (presets[name].checklist) items = JSON.parse(JSON.stringify(presets[name].checklist));
    renderChecklist(); updateUI(); setTimeout(() => startVerification(), 200); save();
}

function updatePresetDropdown() {
    const sel = document.getElementById('presetSelector'); if(!sel) return;
    sel.innerHTML = '<option value="">-- Select Preset --</option>';
    Object.keys(presets).sort().forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name + (name === defaultPreset ? " (Default)" : ""); sel.appendChild(opt); });
}

function addService() {
    const p = document.getElementById('servicePicker'); if (!p || !p.value) return;
    const port = document.getElementById('customPort').value || p.options[p.selectedIndex].dataset.port;
    if (!activeServices.find(s => s.key === p.value)) { activeServices.push({ key: p.value, port: parseInt(port), name: p.options[p.selectedIndex].text, verified: false, lastStatus: 'Waiting', responseTime: 0 }); updateUI(); startVerification(); }
}

function updatePort(index, newPort) { activeServices[index].port = parseInt(newPort) || 0; activeServices[index].verified = false; activeServices[index].lastStatus = 'Waiting'; save(); updateUI(); startVerification(); }

function copyLog(key) {
    const s = activeServices.find(x => x.key === key);
    navigator.clipboard.writeText(`APP: ${s.name}\nPORT: ${s.port}\nSTATUS: ${s.lastStatus}\nTIME: ${s.responseTime || 0}ms\nUA: ${navigator.userAgent}`).then(() => alert("Log Copied!"));
}

function updateUI() {
    const sCont = document.getElementById('status-container'), iList = document.getElementById('instruction-list'), iPanel = document.getElementById('instruction-panel');
    if (!sCont) return; sCont.innerHTML = ""; iList.innerHTML = ""; let hasUnverified = false;
    activeServices.forEach((s, i) => {
        if (!s.verified) hasUnverified = true;
        const div = document.createElement('div'); div.className = 'status-box';
        const color = s.verified ? 'var(--success)' : 'var(--error)';
        div.innerHTML = `<div class="status-top"><span style="color:${color}">● ${s.name}: ${s.verified ? 'OK' : 'Waiting...'}</span><span style="cursor:pointer;opacity:0.5;" onclick="activeServices.splice(${i},1);updateUI();">✕</span></div><div class="status-controls"><span>Port: <input type="number" class="port-edit" value="${s.port}" onchange="updatePort(${i}, this.value)"></span></div>${debugEnabled ? `<div class="debug-area"><div style="font-size:10px; opacity:0.8;">Status: ${s.lastStatus} (${s.responseTime || 0}ms)</div>${!s.verified ? `<button class="main-btn btn-accent" style="padding:2px 5px; font-size:9px; margin-top:5px; width:fit-content;" onclick="copyLog('${s.key}')">Copy Log</button>` : ''}</div>` : ''}`;
        sCont.appendChild(div);
        if (setupHelp[s.key]) iList.innerHTML += `<div style="margin-bottom:6px;">${setupHelp[s.key]}</div>`;
    });
    document.getElementById('recheck-btn').classList.toggle('needs-attention', hasUnverified && !autoScanEnabled);
    document.getElementById('warning-icon').style.display = (hasUnverified && !autoScanEnabled) ? 'inline' : 'none';
    iPanel.style.display = (iList.innerHTML && instrVisible) ? 'block' : 'none';
    document.getElementById('instr-toggle').textContent = instrVisible ? '[Hide]' : '[Show]';
    document.getElementById('timerDisplay').style.display = autoScanEnabled ? 'block' : 'none';
    save();
}

async function startVerification() {
    const checkQueue = activeServices.filter(s => !s.verified);
    if (checkQueue.length === 0 || isScanning) return;
    isScanning = true; const scanID = Date.now();
    await Promise.all(checkQueue.map(async (s) => {
        const start = performance.now();
        const ifr = document.createElement('iframe'); ifr.style.display = "none"; document.body.appendChild(ifr);
        const promise = new Promise(r => {
            const t = setTimeout(() => r({success: false, status: 'Timeout'}), 1500);
            ifr.onload = () => { clearTimeout(t); r({success: true, status: 'Handshake Success'}); };
            ifr.onerror = () => { clearTimeout(t); r({success: true, status: 'Handshake Error'}); };
        });
        ifr.src = `http://127.0.0.1:${s.port}/?scan=${scanID}&t=${Date.now()}`;
        const result = await promise;
        s.responseTime = Math.round(performance.now() - start);
        s.verified = result.success; s.lastStatus = result.status;
        if (document.body.contains(ifr)) document.body.removeChild(ifr);
    }));
    isScanning = false; updateUI(); 
}

function manualResetScan() { activeServices.forEach(s => { s.verified = false; s.lastStatus = 'Waiting'; }); updateUI(); startVerification(); }
function clearAll() { if(confirm("Clear everything?")) { items=[]; activeServices=[]; renderChecklist(); updateUI(); } }
function toggleInstructions() { instrVisible = !instrVisible; updateUI(); }
function toggleDebug(val) { debugEnabled = val; save(); updateUI(); }
function setAsDefault() { const name = document.getElementById('presetSelector').value; if (!name) return alert("Select a preset first"); defaultPreset = name; updatePresetDropdown(); save(); }
function deletePreset() { const name = document.getElementById('presetSelector').value; if (!name || !confirm(`Delete preset "${name}"?`)) return; if (defaultPreset === name) defaultPreset = ""; delete presets[name]; updatePresetDropdown(); save(); }
function toggleAutoScan(val) { autoScanEnabled = val; save(); updateUI(); if (val) startAutoScanLoop(); }
function startAutoScanLoop() { if (autoScanTimer) clearInterval(autoScanTimer); timeLeft = 30; autoScanTimer = setInterval(() => { if (autoScanEnabled) { timeLeft--; if (timeLeft <= 0) { timeLeft = 30; startVerification(); } document.getElementById('timerDisplay').textContent = timeLeft + 's'; } }, 1000); }

function forceInit() {
    const picker = document.getElementById('servicePicker');
    if (!picker) return setTimeout(forceInit, 50); // Wait if HTML not ready
    document.getElementById('autoScanToggle').checked = autoScanEnabled;
    document.getElementById('debugToggle').checked = debugEnabled;
    updatePresetDropdown();
    picker.innerHTML = '<option value="">-- Select App --</option>';
    serviceDefs.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => { const opt = document.createElement('option'); opt.value = s.key; opt.textContent = s.name; opt.dataset.port = s.port; picker.appendChild(opt); });
    picker.onchange = (e) => { const sel = e.target.options[e.target.selectedIndex]; document.getElementById('customPort').value = sel.value ? (sel.dataset.port || "") : ""; };
    if (defaultPreset && presets[defaultPreset]) { loadPreset(defaultPreset); document.getElementById('presetSelector').value = defaultPreset; }
    if (autoScanEnabled) startAutoScanLoop();
    renderChecklist(); updateUI();
}
forceInit();

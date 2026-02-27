/* PreStreamChecklist Engine  */
const setupHelp = { 
    mixitup: "<b>MixItUp</b>: Port 8111.", streamerbot: "<b>Streamer.bot</b>: Port 8080.", veadotube: "<b>Veadotube</b>: Port may need updating. Click Program Settings in Veadotube Mini, ensure Websocket Server is On, then replace Port numbers with those after the ':' in the 'Serving At' field.", vts: "<b>VTube Studio</b>: Scroll down to VTube Studio Plugins and toggle Start API on. Copy the Port number (should be 8001 usually).", vtshr: "<b>vts-heartrate</b>: Scroll down to API Server Settings and copy the API Server Port (typically 8214). If you haven't already, be sure to click Start API Server." , spotify: "<b>Spotify</b>: Must Use Desktop App.", crowdcontrol: "<b>Crowd Control</b>: Port 58430.", sammi: "<b>SAMMI</b>: Port 9450.", voicemod: "<b>Voicemod</b>: Port 59129.", camo: "<b>Camo Studio</b>: Use Port 5555 or 8080."
};

const serviceDefs = [ 
    { key: 'mixitup', name: 'MixItUp', port: 8111 }, { key: 'streamerbot', name: 'Streamer.bot', port: 8080 }, { key: 'veadotube', name: 'Veadotube Mini', port: 57073 }, { key: 'vts', name: 'VTube Studio', port: 8001 }, { key: 'spotify', name: 'Spotify', port: 57621 }, { key: 'crowdcontrol', name: 'Crowd Control', port: 58430 }, { key: 'songify', name: 'Songify', port: 5001 }, { key: 'vbridger', name: 'VBridger', port: 8001 }, { key: 'vtshr', name: 'vts-heartrate', port: 8214 }, { key: 'sammi', name: 'SAMMI', port: 9450 }, { key: 'voicemod', name: 'Voicemod', port: 59129 }, { key: 'camo', name: 'Camo Studio', port: 5555 }
];

const PREFIX = "ps_chk_GGS_";
let items = JSON.parse(localStorage.getItem(PREFIX+'items') || '[{"text":"Check Mic Levels","done":false}]');
let activeServices = JSON.parse(localStorage.getItem(PREFIX+'svc') || '[]');
let presets = JSON.parse(localStorage.getItem(PREFIX+'presets') || '{}');
let defaultPreset = localStorage.getItem(PREFIX+'default_preset') || "";
let instrVisible = JSON.parse(localStorage.getItem(PREFIX+'instr_vis') ?? 'true');
let autoScanEnabled = JSON.parse(localStorage.getItem(PREFIX+'auto_scan') ?? 'false');
let debugEnabled = JSON.parse(localStorage.getItem(PREFIX+'debug') ?? 'false');
let autoScanTimer = null;
let timeLeft = 30
let isScanning = false;
let displayElement = null; 

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

function savePreset() { 
    const nameInput = document.getElementById('newPresetName');
    const name = nameInput ? nameInput.value.trim() : ""; 
    if (!name) return alert("Enter a name"); 
    const cleanSvc = activeServices.map(s => ({...s, verified: false, lastStatus: 'Waiting', responseTime: 0}));
    presets[name] = { svc: cleanSvc, checklist: JSON.parse(JSON.stringify(items)) }; 
    if(nameInput) nameInput.value = "";
    updatePresetDropdown(); save(); 
}

function loadPreset(name) {
    if (!name || !presets[name]) return;
    isScanning = false;
    
    activeServices = JSON.parse(JSON.stringify(presets[name].svc || []));
    
    activeServices.sort((a, b) => a.name.localeCompare(b.name, undefined, {sensitivity: 'base'}));

    if (presets[name].checklist) items = JSON.parse(JSON.stringify(presets[name].checklist));
    
    renderChecklist(); 
    updateUI(); 
    setTimeout(() => startVerification(), 200); 
    save();
}

function updatePresetDropdown() {
    const sel = document.getElementById('presetSelector'); if(!sel) return;
    sel.innerHTML = '<option value="">-- Select Preset --</option>';
    Object.keys(presets).sort().forEach(name => { 
        const opt = document.createElement('option'); 
        opt.value = name; 
        opt.textContent = name + (name === defaultPreset ? " (Default)" : ""); 
        sel.appendChild(opt); 
    });
}

function addService() {
    const p = document.getElementById('servicePicker'); 
    if (!p || !p.value) return;
    const portInput = document.getElementById('customPort');
    const port = (portInput && portInput.value) ? portInput.value : p.options[p.selectedIndex].dataset.port;
    
    if (!activeServices.find(s => s.key === p.value)) { 
        const newSvc = { 
            key: p.value, 
            port: parseInt(port), 
            name: p.options[p.selectedIndex].text, 
            verified: false, 
            lastStatus: 'Waiting', 
            responseTime: 0 
        };
        activeServices.push(newSvc);
        activeServices.sort((a, b) => a.name.localeCompare(b.name));
        updateUI(); 
        startVerification(newSvc);
    }
}

function updatePort(index, newPort) { 
    const service = activeServices[index];
    service.port = parseInt(newPort) || 0; 
    service.verified = false; 
    service.lastStatus = 'Waiting'; 
    save(); 
    updateUI(); 
    startVerification(service); 
}

function setAsDefault() { 
    const name = document.getElementById('presetSelector').value; 
    if (!name) return alert("Select a preset first"); 
    defaultPreset = name; 
    updatePresetDropdown(); 
    save(); 
}

function deletePreset() { 
    const name = document.getElementById('presetSelector').value; 
    if (!name || !confirm(`Delete preset "${name}"?`)) return; 
    if (defaultPreset === name) defaultPreset = ""; 
    delete presets[name]; 
    updatePresetDropdown(); 
    save(); 
}

function updateUI() {
    const sCont = document.getElementById('status-container'), 
          iList = document.getElementById('instruction-list'), 
          iPanel = document.getElementById('instruction-panel'),
          picker = document.getElementById('servicePicker');

    if (!sCont) return; 
    sCont.innerHTML = ""; 
    if(iList) iList.innerHTML = ""; 
    let hasUnverified = false;
    
    activeServices.forEach((s, i) => {
        if (!s.verified) hasUnverified = true;
        const div = document.createElement('div'); div.className = 'status-box';
        const statusText = s.verified ? 'OK' : (s.lastStatus || 'Waiting');
        let color = s.verified ? 'var(--success)' : 'var(--error)';
        if (statusText.includes('Checking')) color = 'var(--warning)';

        div.innerHTML = `<div class="status-top"><span style="color:${color}">● ${s.name}: ${statusText}</span><span style="cursor:pointer;opacity:0.5;" onclick="activeServices.splice(${i},1);updateUI();">✕</span></div><div class="status-controls"><span>Port: <input type="number" class="port-edit" value="${s.port}" onchange="updatePort(${i}, this.value)"></span></div>${debugEnabled ? `<div class="debug-area"><div style="font-size:10px; opacity:0.8;">Status: ${s.lastStatus} (${s.responseTime || 0}ms)</div></div>` : ''}`;
        sCont.appendChild(div);
        
        if (iList && setupHelp[s.key]) {
            iList.innerHTML += `<div class="instr-item">${setupHelp[s.key]}</div>`;
        }
    });

    if (picker && picker.value && setupHelp[picker.value]) {
        const isAlreadyAdded = activeServices.some(s => s.key === picker.value);
        if (!isAlreadyAdded && iList) {
            iList.innerHTML += `<div class="instr-item" style="border-left: 3px solid var(--accent); padding-left: 8px; opacity: 0.8;">${setupHelp[picker.value]}</div>`;
        }
    }

    if(iPanel && iList) {
        const hasContent = iList.innerHTML.trim() !== "";

        iPanel.style.display = hasContent ? 'block' : 'none';
        
        iList.style.display = instrVisible ? 'block' : 'none';
        
        const it = document.getElementById('instr-toggle'); 
        if(it) it.textContent = instrVisible ? '[Hide]' : '[Show]';
    }
    
    const rb = document.getElementById('recheck-btn'); if(rb) rb.classList.toggle('needs-attention', hasUnverified && !autoScanEnabled);
    const wi = document.getElementById('warning-icon'); if(wi) wi.style.display = (hasUnverified && !autoScanEnabled) ? 'inline' : 'none';
    
    const it = document.getElementById('instr-toggle'); if(it) it.textContent = instrVisible ? '[Hide]' : '[Show]';
    const td = document.getElementById('timerDisplay'); if(td) td.style.display = autoScanEnabled ? 'block' : 'none';
    save();
}

async function startVerification(forceService = null) {
    if (isScanning) return;
    
    let checkQueue = [];
    if (forceService) {
        checkQueue = [forceService];
    } else {
        checkQueue = activeServices.filter(s => !s.verified);
    }

    if (checkQueue.length === 0) return;
    
    isScanning = true;
    
    checkQueue.forEach(s => {
        s.verified = false; 
        s.lastStatus = `Checking ${s.port}...`;
    });
    updateUI(); 

    try {
        await Promise.all(checkQueue.map((s) => {
            return new Promise((resolve) => {
                const probe = document.createElement('script');
                const start = performance.now();
                let responded = false;
                const done = (success, status) => {
                    if (responded) return; responded = true;
                    clearTimeout(timeout);
                    probe.onerror = probe.onload = null;
                    if (probe.parentNode) probe.parentNode.removeChild(probe);
                    s.verified = success; s.lastStatus = status;
                    s.responseTime = Math.round(performance.now() - start);
                    resolve();
                };
                const timeout = setTimeout(() => done(false, 'Offline'), 1500);
                probe.onerror = () => done(true, 'Connected');
                probe.onload = () => done(true, 'Connected');
                probe.src = `http://127.0.0.1:${s.port}/ping?t=${Date.now()}`;
                document.head.appendChild(probe);
            });
        }));
    } finally {
        isScanning = false;
        updateUI();
    }
}

function manualResetScan() { 
    isScanning = false;
    
    if (autoScanEnabled) { 
        timeLeft = 30; 
        const td = document.getElementById('timerDisplay'); 
        if(td) td.textContent = '30s'; 
    }
    
    updateUI(); 
    setTimeout(() => startVerification(), 50);
}

function startAutoScanLoop() {
    if (autoScanTimer) clearInterval(autoScanTimer);
    timeLeft = 30;
    
    autoScanTimer = setInterval(() => {
        displayElement = document.getElementById('timerDisplay');
        
        if (!autoScanEnabled) { 
            if(display) display.style.display = 'none'; 
            clearInterval(autoScanTimer); 
            autoScanTimer = null;
            return; 
        }

        timeLeft--;
        if (displayElement) { 
            displayElement.style.display = 'block'; 
            displayElement.textContent = timeLeft + 's'; 
        }

        if (timeLeft <= 0) { 
            timeLeft = 30; 
            startVerification(); 
        }
    }, 1000);
}

function forceInit() {
    const picker = document.getElementById('servicePicker');
    const pSelector = document.getElementById('presetSelector');
    if (!picker || !pSelector) return setTimeout(forceInit, 50);

    const asT = document.getElementById('autoScanToggle'); if(asT) asT.checked = autoScanEnabled;
    const dbT = document.getElementById('debugToggle'); if(dbT) dbT.checked = debugEnabled;
    
    updatePresetDropdown();
    pSelector.onchange = (e) => loadPreset(e.target.value);

    picker.innerHTML = '<option value="">-- Select App --</option>';
    serviceDefs.sort((a,b) => a.name.localeCompare(b.name)).forEach(s => { 
        const opt = document.createElement('option'); opt.value = s.key; opt.textContent = s.name; opt.dataset.port = s.port; picker.appendChild(opt); 
    });

    picker.onchange = (e) => { 
        const sel = e.target.options[e.target.selectedIndex]; 
        const cp = document.getElementById('customPort'); 
        if(cp) cp.value = sel.value ? (sel.dataset.port || "") : ""; 
        updateUI();
    };
    

    if (defaultPreset && presets[defaultPreset]) { 
        activeServices = JSON.parse(JSON.stringify(presets[defaultPreset].svc || []));
        items = JSON.parse(JSON.stringify(presets[defaultPreset].checklist || []));
        pSelector.value = defaultPreset; 
    }
    
    if (autoScanEnabled) startAutoScanLoop();
    renderChecklist(); 
    updateUI();
}
forceInit();

window.setAsDefault = setAsDefault; 
window.deletePreset = deletePreset; 
window.savePreset = savePreset; 
window.manualResetScan = manualResetScan;
window.toggleAutoScan = (v) => { autoScanEnabled = v; save(); updateUI(); if(v) startAutoScanLoop(); };
window.toggleDebug = (v) => { debugEnabled = v; save(); updateUI(); };
window.addItem = addItem; 
window.bulkCheck = bulkCheck; 
window.toggleItem = toggleItem;
window.toggleInstructions = () => { 
    instrVisible = !instrVisible; 
    displayElement = document.getElementById('timerDisplay');
    updateUI(); 
};

window.clearAll = () => { 
    if(confirm("Clear everything?")) { 
        items=[]; 
        activeServices=[]; 
        renderChecklist(); 
        updateUI(); 
    } 
};






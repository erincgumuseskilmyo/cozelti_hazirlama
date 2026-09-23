// ===== ÇÖZELTİ LABORATUVARI — 3D (three.js cel-shading + cannon-es fizik) =====
import { Lab3D } from './lab3d.js';

const lab = await Lab3D.create(document.getElementById('lab3d'));
window.lab = lab;
document.getElementById('loading').remove();

// ===== OYUN DURUMU =====
const GameState = {
    currentScreen: 'menu',
    currentLesson: 0,
    currentTask: null,
    currentStep: 1,
    scores: { calculation: 0, equipment: 0, measurement: 0, procedure: 0, safety: 0 },
    flags: {
        calculationCorrect: false, equipmentCorrect: false, measurementCorrect: false,
        procedureCorrect: false, safetyCorrect: false, dissolved: false, mixed: false,
        ppeComplete: false, acidCorrect: false
    },
    measuredMass: 0, measuredVolume: 0, addedWater: 0,
    selectedEquipment: [], busy: false
};

// ===== GÖREV VERİLERİ =====
const TASKS = [
    {
        id: 'TASK_001', title: 'Yüzde Çözelti (Katı-Sıvı)',
        description: '100 mL %10 NaCl çözeltisi hazırlayınız.',
        type: 'PERCENTAGE',
        chemical: { name: 'Sodyum Klorür', formula: 'NaCl', molarMass: 58.44 },
        targetConcentration: 10, targetVolume: 100,
        requiredMass: 10.0, requiredStockVolume: 0, stockConcentration: 0,
        explanation: '%10 NaCl: 100 mL için 10 g NaCl tartılır, balon jojede 100 mL\'ye tamamlanır.',
        grainColor: 0xfafafa, dissolvedColor: 0xa8dcf7
    },
    {
        id: 'TASK_002', title: 'Molar Çözelti (Katı-Sıvı)',
        description: '250 mL 0.5 M NaCl çözeltisi hazırlayınız.',
        type: 'MOLAR',
        chemical: { name: 'Sodyum Klorür', formula: 'NaCl', molarMass: 58.44 },
        targetConcentration: 0.5, targetVolume: 250,
        requiredMass: 7.31, requiredStockVolume: 0, stockConcentration: 0,
        explanation: '0.5 M NaCl: 250 mL = 0.250 L, mol = 0.5 x 0.250 = 0.125 mol, kütle = 0.125 x 58.44 = 7.31 g',
        grainColor: 0xfafafa, dissolvedColor: 0xa8dcf7
    },
    {
        id: 'TASK_003', title: 'Normal Çözelti (Sıvı-Sıvı)',
        description: '250 mL 0.1 N HCl çözeltisi hazırlayınız. (Stok: ~12 M HCl)',
        type: 'NORMAL',
        chemical: { name: 'Hidroklorik Asit', formula: 'HCl', molarMass: 36.46 },
        targetConcentration: 0.1, targetVolume: 250,
        requiredMass: 0, requiredStockVolume: 2.08, stockConcentration: 12,
        explanation: '0.1 N HCl: Stok HCl ~12 M. C1V1 = C2V2 => 12 x V1 = 0.1 x 250 => V1 ~ 2.08 mL stok HCl alınır.',
        stockColor: 0xf7e07e
    },
    {
        id: 'TASK_004', title: 'Yüzde Çözelti (Sıvı-Sıvı)',
        description: '100 mL %30 etanol çözeltisi hazırlayınız. (Stok: %96 etanol)',
        type: 'PERCENTAGE_LIQUID',
        chemical: { name: 'Etanol', formula: 'C2H5OH', molarMass: 46.07 },
        targetConcentration: 30, targetVolume: 100,
        requiredMass: 0, requiredStockVolume: 31.25, stockConcentration: 96,
        explanation: '100 mL %30 etanol: 96 x V1 = 30 x 100 => V1 = 31.25 mL stok etanol alınır, 100 mL\'ye tamamlanır.',
        stockColor: 0xd8f0ff
    },
    {
        id: 'TASK_005', title: 'Molar Çözelti (Sıvı-Sıvı)',
        description: '250 mL 0.1 M H2SO4 çözeltisi hazırlayınız. (Stok: 1 M H2SO4)',
        type: 'MOLAR_LIQUID',
        chemical: { name: 'Sülfürik Asit', formula: 'H2SO4', molarMass: 98.08 },
        targetConcentration: 0.1, targetVolume: 250,
        requiredMass: 0, requiredStockVolume: 25.0, stockConcentration: 1,
        explanation: '250 mL 0.1 M H2SO4: 1 x V1 = 0.1 x 250 => V1 = 25 mL stok H2SO4 alınır, 250 mL\'ye tamamlanır.',
        stockColor: 0xfff1a8
    }
];

const EQUIPMENT_TYPES = [
    { id: 'BALANCE', name: 'Terazi', emoji: '⚖️' },
    { id: 'SPATULA', name: 'Spatul', emoji: '🥄' },
    { id: 'BEAKER', name: 'Beher', emoji: '🥃' },
    { id: 'VOLUMETRIC_FLASK', name: 'Balon Joje', emoji: '🧪' },
    { id: 'GRADUATED_CYLINDER', name: 'Mezür', emoji: '📏' },
    { id: 'PIPETTE', name: 'Pipet', emoji: '💉' },
    { id: 'DISTILLED_WATER', name: 'Saf Su', emoji: '💧' },
    { id: 'REAGENT_BOTTLE', name: 'Reaktif Şişesi', emoji: '🧴' },
    { id: 'WASTE_CONTAINER', name: 'Atık Kabı', emoji: '🗑️' },
    { id: 'SAFETY_GOGGLES', name: 'Koruyucu Gözlük', emoji: '🥽' },
    { id: 'GLOVES', name: 'Eldiven', emoji: '🧤' },
    { id: 'LAB_COAT', name: 'Laboratuvar Önlüğü', emoji: '🥼' }
];

function isLiquidTask(task) {
    return task && (task.type === 'PERCENTAGE_LIQUID' || task.type === 'MOLAR_LIQUID' || task.type === 'NORMAL');
}
function getTaskTypeLabel(type) {
    const labels = {
        'PERCENTAGE': 'Yüzde (Katı-Sıvı)', 'MOLAR': 'Molar (Katı-Sıvı)',
        'NORMAL': 'Normal (Sıvı-Sıvı)', 'PERCENTAGE_LIQUID': 'Yüzde (Sıvı-Sıvı)',
        'MOLAR_LIQUID': 'Molar (Sıvı-Sıvı)'
    };
    return labels[type] || type;
}
function $(id) { return document.getElementById(id); }
function setBusy(b) {
    GameState.busy = b;
    document.querySelectorAll('.lab-panel button').forEach((btn) => { btn.disabled = b; });
}
function toast(msg, kind = 'info') {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + kind;
    clearTimeout(toast._h);
    toast._h = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ===== EKRAN YÖNETİMİ =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $('screen-' + screenId).classList.add('active');
    GameState.currentScreen = screenId;
    lab.onTick = null;
    if (screenId === 'tutorial') renderTutorial();
    if (screenId === 'task-select') renderTaskSelect();
    if (screenId === 'safety') renderSafety();
    if (screenId !== 'lab' && screenId !== 'safety') lab.layout('idle');
}

// ===== EĞİTİM MODU =====
const LESSONS = [
    {
        title: 'Ders 1 - Yüzde Çözeltiler (Katı-Sıvı)',
        concept: 'Yüzde çözelti, belirli miktardaki çözünen maddenin çözelti hacmine oranıdır.',
        formula: '% çözelti = (çözünen madde kütlesi / çözelti hacmi) x 100',
        example: 'Örnek: %10 NaCl, 100 mL\n\n10 g NaCl gerekir ve son hacim 100 mL olmalıdır.',
        important: 'ÖNEMLİ: "100 mL su eklemek" ile "çözeltinin son hacmini 100 mL\'ye tamamlamak" farklı şeylerdir!\n\nDoğru yöntem: Katıyı biraz su ile çöz, sonra balon jojeyi çizgisine kadar doldur.',
        practice: { q: '%10 NaCl, 100 mL için kaç g NaCl gerekir?', a: 10.0, unit: 'g', tolerance: 0.5 }
    },
    {
        title: 'Ders 2 - Molar Çözeltiler (Katı-Sıvı)',
        concept: 'Molarite (M), bir litre çözeltideki çözünen maddenin mol sayısıdır.',
        formula: 'M = mol / L\nmol = M x V(L)\nkütle = mol x molar kütle',
        example: 'Örnek: 0.5 M NaCl, 250 mL\n\nV = 0.250 L\nn = 0.5 x 0.250 = 0.125 mol\nkütle = 0.125 x 58.44 = 7.31 g NaCl',
        important: 'ÖNEMLİ: Hacmi her zaman litreye çevir! 250 mL = 0.250 L\n\nDoğru yöntem: 7.31 g NaCl tart, balon jojeye aktar, biraz su ile çöz, sonra 250 mL çizgisine kadar tamamla.',
        practice: { q: '0.5 M NaCl, 250 mL için kaç g NaCl gerekir?', a: 7.31, unit: 'g', tolerance: 0.37 }
    },
    {
        title: 'Ders 3 - Sıvı-Sıvı Seyreltme',
        concept: 'Stok çözeltiden daha seyreltik çözelti hazırlamak için seyreltme formülü kullanılır.',
        formula: 'C1V1 = C2V2\n\nC1 = Stok konsantrasyon\nV1 = Alınacak stok hacmi\nC2 = Hedef konsantrasyon\nV2 = Hedef hacim',
        example: 'Örnek: 100 mL %30 etanol (Stok: %96)\n\n96 x V1 = 30 x 100\nV1 = 3000 / 96 = 31.25 mL stok etanol alınır.',
        important: 'ÖNEMLİ: Sıvı-sıvı çözeltilerde terazi yerine PİPET veya MEZÜR kullanılır!\n\nDoğru yöntem: Pipetle stoktan al, balon jojeye aktar, suyla tamamla. Asitlerde ASİT SUYA EKLENİR!',
        practice: { q: 'Stok %96 etanoldan 100 mL %30 etanol için kaç mL stok gerekir?', a: 31.25, unit: 'mL', tolerance: 1.5 }
    }
];

function renderTutorial() {
    const lesson = LESSONS[GameState.currentLesson];
    $('tutorial-title').textContent = lesson.title;
    $('lesson-page').textContent = (GameState.currentLesson + 1) + ' / ' + LESSONS.length;
    $('btn-prev').disabled = GameState.currentLesson === 0;
    $('btn-next').textContent = GameState.currentLesson === LESSONS.length - 1 ? 'Menüye Dön' : 'Sonraki ▶';
    $('tutorial-content').innerHTML = '<h3>' + lesson.title + '</h3>' +
        '<p>' + lesson.concept + '</p>' +
        '<div class="formula-box">' + lesson.formula.replace(/\n/g, '<br>') + '</div>' +
        '<div class="example-box">' + lesson.example.replace(/\n/g, '<br>') + '</div>' +
        '<div class="warning-box">' + lesson.important.replace(/\n/g, '<br>') + '</div>' +
        '<div class="practice-box">' +
        '<h4>Pratik: ' + lesson.practice.q + '</h4>' +
        '<div class="input-row">' +
        '<input type="text" id="practice-input" placeholder="Cevap">' +
        '<span>' + lesson.practice.unit + '</span>' +
        '<button class="btn btn-check" onclick="checkPractice(' + lesson.practice.a + ',' + lesson.practice.tolerance + ')">Kontrol Et</button>' +
        '</div><p id="practice-result"></p></div>';
}
function nextLesson() {
    if (GameState.currentLesson < LESSONS.length - 1) { GameState.currentLesson++; renderTutorial(); }
    else { GameState.currentLesson = 0; showScreen('menu'); }
}
function prevLesson() {
    if (GameState.currentLesson > 0) { GameState.currentLesson--; renderTutorial(); }
}
function checkPractice(answer, tolerance) {
    const val = parseFloat($('practice-input').value.replace(',', '.'));
    const result = $('practice-result');
    if (isNaN(val)) { result.innerHTML = '<span class="err">Geçerli sayı gir.</span>'; return; }
    result.innerHTML = Math.abs(val - answer) <= tolerance
        ? '<span class="ok">Doğru! Tebrikler.</span>'
        : '<span class="err">Yaklaşık değil. Tekrar dene.</span>';
}

// ===== GÖREV SEÇİMİ =====
function renderTaskSelect() {
    $('task-list').innerHTML = TASKS.map((task, i) => {
        const isLiq = isLiquidTask(task);
        return '<div class="task-card">' +
            '<h3>' + getTaskTypeLabel(task.type) + '</h3>' +
            '<p class="muted">' + task.chemical.name + ' (' + task.chemical.formula + ')</p>' +
            '<p>' + task.description + '</p>' +
            '<p class="eq-hint">' + (isLiq ? 'Pipet/Mezür + Balon Joje + Saf Su' : 'Terazi + Spatul + Balon Joje + Saf Su') + ' · KKD: Önlük + Gözlük + Eldiven</p>' +
            '<button class="menu-btn btn-blue inline" onclick="startTask(' + i + ')">Göreve Başla</button>' +
            '</div>';
    }).join('');
}

function startTask(index) {
    const task = TASKS[index];
    GameState.currentTask = task;
    GameState.currentStep = 1;
    GameState.measuredMass = 0;
    GameState.measuredVolume = 0;
    GameState.addedWater = 0;
    GameState.selectedEquipment = [];
    GameState.scores = { calculation: 0, equipment: 0, measurement: 0, procedure: 0, safety: 0 };
    GameState.flags = {
        calculationCorrect: false, equipmentCorrect: false, measurementCorrect: false,
        procedureCorrect: false, safetyCorrect: false, dissolved: false, mixed: false,
        ppeComplete: false, acidCorrect: false
    };
    lab.clearSelection();
    lab.configureTask({ targetVolume: task.targetVolume, stockColor: task.stockColor, dissolvedColor: task.dissolvedColor, grainColor: task.grainColor, solidChemical: isLiquidTask(task) ? null : task.chemical.formula });
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? '%' : 'M';
    lab.setStockLabel(isLiquidTask(task) ? 'Stok: ' + task.stockConcentration + ' ' + concUnit + ' ' + task.chemical.formula : 'Stok');
    showScreen('lab');
    renderLabStep();
}

// ===== LABORATUVAR ADIMLARI =====
const STEP_NAMES = ['Görev', 'Hesaplama', 'Ekipman', 'Ölçüm', 'Aktarma', 'Su Ekleme', 'Sonuç'];
function renderLabStep() {
    const task = GameState.currentTask;
    const isLiq = isLiquidTask(task);
    $('lab-task-desc').textContent = task.description;
    $('lab-step-title').textContent = 'Adım ' + GameState.currentStep + ' / 7 — ' + STEP_NAMES[GameState.currentStep - 1];
    $('lab-steps').innerHTML = STEP_NAMES.map((n, i) => '<span class="' + (i + 1 < GameState.currentStep ? 'done' : (i + 1 === GameState.currentStep ? 'cur' : '')) + '">' + (i + 1) + '</span>').join('');
    const content = $('lab-content');
    content.classList.toggle('side', (GameState.currentStep === 4 && !isLiq) || GameState.currentStep === 6);
    lab.onTick = null;
    const modes = { 1: 'done', 2: 'done', 3: 'equipment', 4: isLiq ? 'pipette' : 'weigh', 5: isLiq ? 'pipette' : 'transfer', 6: 'water', 7: 'done' };
    lab.layout(modes[GameState.currentStep], { liquid: isLiq });
    switch (GameState.currentStep) {
        case 1: renderStep1(content, task); break;
        case 2: renderStep2(content, task); break;
        case 3: renderStep3(content, task); break;
        case 4: renderStep4(content, task); break;
        case 5: renderStep5(content, task); break;
        case 6: renderStep6(content, task); break;
        case 7: renderStep7(content, task); break;
    }
}

function renderStep1(content, task) {
    const isLiq = isLiquidTask(task);
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : (task.type.indexOf('MOLAR') >= 0 ? ' M' : ' N');
    content.innerHTML = '<h3>GÖREV: ' + task.description + '</h3>' +
        '<div class="info-box">' +
        '<p><strong>Kimyasal:</strong> ' + task.chemical.name + ' (' + task.chemical.formula + ')</p>' +
        '<p><strong>Hedef:</strong> ' + task.targetVolume + ' mL, ' + task.targetConcentration + concUnit + '</p>' +
        (isLiq ? '<p class="err"><strong>Stok:</strong> ' + task.stockConcentration + (task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : ' M') + ' ' + task.chemical.name + '</p>' : '') +
        '<p class="muted">' + (isLiq ? 'Bu bir sıvı-sıvı seyreltme görevidir. C1V1 = C2V2 formülünü kullan.' : 'Bu bir katı-sıvı çözelti hazırlama görevidir.') + '</p>' +
        '</div>' +
        '<p class="muted">Önce hesaplamanı yap, sonra Devam Et butonuna tıkla. Sahneyi fareyle döndürebilirsin.</p>' +
        '<div class="btn-row"><button class="menu-btn btn-blue inline" onclick="goToStep(2)">Devam Et</button></div>';
}

function renderStep2(content, task) {
    const isLiq = isLiquidTask(task);
    const unit = isLiq ? 'mL' : 'g';
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : ' M';
    content.innerHTML = '<h3>Hesaplamanı yap ve sonucu gir:</h3>' +
        '<div class="info-box warm">' +
        '<p><strong>Görev:</strong> ' + task.description + '</p>' +
        (isLiq ?
            '<p>Stok konsantrasyon: <strong>' + task.stockConcentration + concUnit + '</strong></p>' +
            '<p>Hedef: <strong>' + task.targetVolume + ' mL</strong> çözelti</p>' :
            '<p>Hedef hacim: <strong>' + task.targetVolume + ' mL</strong></p>' +
            '<p>Molar kütle: <strong>' + task.chemical.molarMass + ' g/mol</strong></p>') +
        '</div>' +
        '<div class="input-row center">' +
        '<input type="text" id="calc-input" placeholder="Değer">' +
        '<span class="unit">' + unit + '</span>' +
        '<button class="btn btn-check" onclick="checkCalculation()">Kontrol Et</button>' +
        '</div>' +
        '<p id="calc-result" class="result"></p>';
}
function checkCalculation() {
    const val = parseFloat($('calc-input').value.replace(',', '.'));
    const task = GameState.currentTask;
    const isLiq = isLiquidTask(task);
    const target = isLiq ? task.requiredStockVolume : task.requiredMass;
    const result = $('calc-result');
    if (isNaN(val)) { result.innerHTML = '<span class="err">Geçerli sayı gir.</span>'; return; }
    if (Math.abs(val - target) <= target * 0.05) {
        result.innerHTML = '<span class="ok">Doğru! ' + val + ' ' + (isLiq ? 'mL' : 'g') + '</span>';
        GameState.scores.calculation = 20;
        GameState.flags.calculationCorrect = true;
        setTimeout(() => goToStep(3), 1000);
    } else {
        result.innerHTML = '<span class="err">Yaklaşık değil. Tekrar dene.</span>';
        GameState.scores.calculation = 0;
    }
}

// ===== ADIM 3: EKİPMAN (3D raftan tıklayarak seç) =====
function renderStep3(content, task) {
    const isLiq = isLiquidTask(task);
    content.innerHTML = '<h3>Raftaki ekipmanlara tıklayarak seç:</h3>' +
        '<p class="muted">' + (isLiq ? 'Sıvı-sıvı görevinde pipet/mezür, balon joje ve saf su gerekir.' : 'Katı-sıvı görevinde terazi, spatul, balon joje ve saf su gerekir.') + ' <strong>Her uygulamada laboratuvar önlüğü, koruyucu gözlük ve eldiven zorunludur.</strong></p>' +
        '<div class="chip-row" id="eq-chips"><span class="muted">Henüz ekipman seçilmedi.</span></div>' +
        '<div class="btn-row"><button class="menu-btn btn-green inline" onclick="checkEquipment()">Ekipmanları Onayla</button></div>' +
        '<p id="eq-result" class="result"></p>';
    lab.onPick = toggleEquipment;
    renderChips();
}
function renderChips() {
    const el = $('eq-chips');
    if (!el) return;
    if (!GameState.selectedEquipment.length) { el.innerHTML = '<span class="muted">Henüz ekipman seçilmedi.</span>'; return; }
    el.innerHTML = GameState.selectedEquipment.map((id) => {
        const eq = EQUIPMENT_TYPES.find((e) => e.id === id);
        return '<button class="chip" onclick="toggleEquipment(\'' + id + '\')">' + eq.emoji + ' ' + eq.name + ' ✕</button>';
    }).join('');
}
function toggleEquipment(id) {
    const idx = GameState.selectedEquipment.indexOf(id);
    if (idx === -1) { GameState.selectedEquipment.push(id); lab.setSelected(id, true); }
    else { GameState.selectedEquipment.splice(idx, 1); lab.setSelected(id, false); }
    renderChips();
}
function checkEquipment() {
    const task = GameState.currentTask;
    const isLiq = isLiquidTask(task);
    const has = (id) => GameState.selectedEquipment.indexOf(id) >= 0;
    const missing = [];
    if (isLiq) {
        if (!has('PIPETTE') && !has('GRADUATED_CYLINDER')) missing.push('Pipet veya Mezür');
    } else {
        if (!has('BALANCE')) missing.push('Terazi');
        if (!has('SPATULA')) missing.push('Spatul');
    }
    if (!has('VOLUMETRIC_FLASK')) missing.push('Balon Joje');
    if (!has('DISTILLED_WATER')) missing.push('Saf Su');
    if (!has('LAB_COAT')) missing.push('Laboratuvar Önlüğü');
    if (!has('SAFETY_GOGGLES')) missing.push('Koruyucu Gözlük');
    if (!has('GLOVES')) missing.push('Eldiven');
    const result = $('eq-result');
    if (!missing.length) {
        result.innerHTML = '<span class="ok">Doğru ekipmanlar seçildi!</span>';
        GameState.scores.equipment = 10;
        GameState.flags.equipmentCorrect = true;
        lab.onPick = null;
        setTimeout(() => goToStep(4), 1000);
    } else {
        result.innerHTML = '<span class="err">Eksik ekipman: ' + missing.join(', ') + '</span>';
        toast(isLiq
            ? 'Eksik var. Pipet/Mezür, Balon Joje, Saf Su ve KKD (önlük, gözlük, eldiven) seçmelisin.'
            : 'Eksik var. Terazi, Spatul, Balon Joje, Saf Su ve KKD (önlük, gözlük, eldiven) seçmelisin.', 'err');
    }
}

// ===== ADIM 4: TART veya HACİM ÖLÇ =====
function renderStep4(content, task) {
    if (isLiquidTask(task)) renderStep4Liquid(content, task);
    else renderStep4Solid(content, task);
}
function renderStep4Solid(content, task) {
    const target = task.requiredMass;
    content.innerHTML = '<h3>Terazi — Hedef: ' + target.toFixed(2) + ' g</h3>' +
        '<p class="muted"><strong>Spatulü sürükle:</strong> önce <strong>' + task.chemical.formula + ' kavanozuna</strong> götür (kaşık dolar), sonra <strong>tartım kabının</strong> üstüne bırak. Terazi kabın içindeki taneleri anlık gösterir.</p>' +
        '<div class="balance-display"><span class="value" id="mass-display">0.00 g</span></div>' +
        '<div class="btn-row">' +
        '<button class="menu-btn btn-gray inline" onclick="removeMass()">Azalt (−0.5 g)</button>' +
        '<button class="menu-btn btn-green inline" onclick="confirmMass()">Tartımı Onayla</button>' +
        '</div>' +
        '<p id="mass-result" class="result"></p>';
    lab.onTick = () => {
        GameState.measuredMass = lab.getPanMass();
        const el = $('mass-display');
        if (el) el.textContent = GameState.measuredMass.toFixed(2) + ' g';
    };
}
function renderStep4Liquid(content, task) {
    const target = task.requiredStockVolume;
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? '%' : 'M';
    content.innerHTML = '<h3>Pipetle Stoktan Al — Hedef: ' + target.toFixed(2) + ' mL</h3>' +
        '<p class="muted">Stok: ' + task.stockConcentration + ' ' + concUnit + ' ' + task.chemical.name + ' → Balon jojeye aktar</p>' +
        '<div class="readouts">' +
        '<div><span class="lab-k">Pipet</span><span class="lab-v" id="pipet-volume">0.00 mL</span></div>' +
        '<div><span class="lab-k">Balon Joje</span><span class="lab-v" id="flask-stock-vol">0.00 mL</span></div>' +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="menu-btn btn-purple inline" onclick="drawStock()">Pipetle Çek</button>' +
        '<button class="menu-btn btn-orange inline" onclick="releaseStock()">Jojeye Bırak</button>' +
        '<button class="menu-btn btn-green inline" onclick="confirmVolume()">Hacmi Onayla</button>' +
        '</div>' +
        '<p id="volume-result" class="result"></p>';
    GameState.pipetteHeld = 0;
}

function removeMass() {
    if (GameState.busy) return;
    lab.removeSome(0.5);
}
function confirmMass() {
    if (lab.spatulaBusy) return;
    const task = GameState.currentTask;
    const target = task.requiredMass;
    GameState.measuredMass = lab.getPanMass();
    const accuracy = Math.max(0, 1.0 - Math.abs(GameState.measuredMass - target) / target);
    const result = $('mass-result');
    if (accuracy >= 0.95) {
        result.innerHTML = '<span class="ok">Mükemmel tartım!</span>';
        GameState.scores.measurement = 20; GameState.flags.measurementCorrect = true;
        setTimeout(() => goToStep(5), 1000);
    } else if (accuracy >= 0.80) {
        result.innerHTML = '<span class="warn">Kabul edilebilir, ama daha hassas olabilirsin.</span>';
        GameState.scores.measurement = accuracy >= 0.90 ? 15 : (accuracy >= 0.85 ? 12 : 10);
        GameState.flags.measurementCorrect = true;
        setTimeout(() => goToStep(5), 1500);
    } else {
        result.innerHTML = '<span class="err">Madde miktarı hedef değerden uzak. Hesaplamanı kontrol et.</span>';
        GameState.scores.measurement = 5;
    }
}

async function drawStock() {
    if (GameState.busy) return;
    setBusy(true);
    const amount = 0.5 + Math.random() * 2.0;
    GameState.pipetteHeld += amount;
    GameState.measuredVolume += amount;
    $('pipet-volume').textContent = GameState.pipetteHeld.toFixed(2) + ' mL';
    lab.setPipetteLabel(GameState.pipetteHeld.toFixed(2) + ' mL');
    await lab.pipetteDraw(Math.min(1, GameState.pipetteHeld / 50));
    setBusy(false);
}
async function releaseStock() {
    if (GameState.busy || GameState.pipetteHeld <= 0) return;
    setBusy(true);
    const held = GameState.pipetteHeld;
    GameState.pipetteHeld = 0;
    lab.setPipetteLabel('0.00 mL');
    $('pipet-volume').textContent = '0.00 mL';
    lab.onTick = () => { const el = $('flask-stock-vol'); if (el) el.textContent = lab.flaskStockVol.toFixed(2) + ' mL'; };
    await lab.pipetteRelease(held);
    lab.onTick = null;
    $('flask-stock-vol').textContent = GameState.measuredVolume.toFixed(2) + ' mL';
    setBusy(false);
}
function confirmVolume() {
    if (GameState.busy) return;
    const task = GameState.currentTask;
    const target = task.requiredStockVolume;
    const accuracy = Math.max(0, 1.0 - Math.abs(GameState.measuredVolume - target) / target);
    const result = $('volume-result');
    if (accuracy >= 0.95) {
        result.innerHTML = '<span class="ok">Mükemmel hacim ölçümü!</span>';
        GameState.scores.measurement = 20; GameState.flags.measurementCorrect = true;
        setTimeout(() => goToStep(5), 1000);
    } else if (accuracy >= 0.80) {
        result.innerHTML = '<span class="warn">Kabul edilebilir, ama daha hassas olabilirsin.</span>';
        GameState.scores.measurement = accuracy >= 0.90 ? 15 : (accuracy >= 0.85 ? 12 : 10);
        GameState.flags.measurementCorrect = true;
        setTimeout(() => goToStep(5), 1500);
    } else {
        result.innerHTML = '<span class="err">Hacim hedef değerden uzak. Tekrar ölç.</span>';
        GameState.scores.measurement = 5;
    }
}

// ===== ADIM 5: AKTAR =====
function renderStep5(content, task) {
    const isLiq = isLiquidTask(task);
    content.innerHTML = '<h3>' + (isLiq ? 'Stok Çözeltiyi Balon Jojeye Aktar' : 'Katıyı Balon Jojeye Aktar') + '</h3>' +
        '<p class="muted">' + (isLiq ? 'Pipetteki kalan çözeltiyi jojeye boşalt.' : 'Spatul ile tartım kabındaki taneleri balon jojenin boynundan içeri aktar.') + '</p>' +
        '<div class="btn-row"><button class="menu-btn btn-orange inline" id="transfer-btn" onclick="doTransfer()">' + (isLiq ? 'Stok Çözeltiyi Aktar' : 'Spatul ile Aktar') + '</button></div>' +
        '<div id="transfer-result"></div>';
}
async function doTransfer() {
    if (GameState.busy) return;
    const btn = $('transfer-btn');
    btn.textContent = 'Aktarılıyor...';
    setBusy(true);
    const task = GameState.currentTask;
    if (isLiquidTask(task)) await lab.transferLiquid();
    else await lab.transferSolid(task.grainColor);
    setBusy(false);
    $('transfer-result').innerHTML =
        '<p class="ok big">Aktarım tamamlandı!</p>' +
        '<div class="btn-row"><button class="menu-btn btn-blue inline" onclick="goToStep(6)">Devam Et</button></div>';
    btn.style.display = 'none';
}

// ===== ADIM 6: SU EKLE (piset sürükle + bastır) =====
function renderStep6(content, task) {
    const isLiq = isLiquidTask(task);
    content.innerHTML = '<h3>Saf Su Ekleme</h3>' +
        '<p class="muted"><strong>Piseti sürükle</strong>, ucunu balon jojenin boynundaki halkaya getir; <strong>tuttuğun sürece</strong> su akar. Bırakınca durur.</p>' +
        '<div class="readouts">' +
        '<div><span class="lab-k">Hacim</span><span class="lab-v" id="volume-label">0 mL</span></div>' +
        '<div><span class="lab-k">Hedef (çizgi)</span><span class="lab-v">' + task.targetVolume + ' mL</span></div>' +
        '</div>' +
        '<div class="btn-row">' +
        (isLiq ? '' : '<button class="btn btn-purple" onclick="dissolve()">Çöz</button>') +
        '<button class="btn btn-orange" onclick="mixSolution()">Karıştır</button>' +
        '<button class="btn btn-check" onclick="confirmMark()">Hacmi Onayla</button>' +
        '</div>' +
        '<p id="step6-feedback" class="result muted">' + (isLiq ? 'Önce biraz su ekle, sonra karıştır, sonra çizgiye kadar tamamla.' : 'Önce biraz su ekle, sonra çöz, karıştır ve çizgiye kadar tamamla.') + '</p>';
    lab.onTick = () => {
        const el = $('volume-label');
        if (!el) return;
        const v = lab.flaskVolume;
        el.textContent = v.toFixed(1) + ' mL';
        el.style.color = v > task.targetVolume * 1.02 ? '#ff7b7b' : (Math.abs(v - task.targetVolume) <= task.targetVolume * 0.02 ? '#7cfc8b' : '#ffe08a');
    };
    lab.onPour = (kind) => { if (kind === 'water') GameState.addedWater = lab.flaskWaterVol; };
}
function feedback6(html, cls) {
    const fb = $('step6-feedback');
    fb.className = 'result ' + (cls || '');
    fb.innerHTML = html;
}
async function dissolve() {
    if (GameState.busy) return;
    if (lab.flaskWaterVol > 0 && !GameState.flags.dissolved) {
        setBusy(true);
        GameState.flags.dissolved = true;
        await lab.dissolve();
        feedback6('<span class="ok">Çözelti çözüldü. Şimdi karıştır.</span>');
        setBusy(false);
    } else if (lab.flaskWaterVol <= 0) {
        feedback6('<span class="err">Önce pisetle biraz su ekle!</span>');
    }
}
async function mixSolution() {
    if (GameState.busy) return;
    const isLiq = isLiquidTask(GameState.currentTask);
    if (lab.flaskWaterVol <= 0) { feedback6('<span class="err">Önce pisetle biraz su ekle!</span>'); return; }
    if ((GameState.flags.dissolved || isLiq) && !GameState.flags.mixed) {
        setBusy(true);
        GameState.flags.mixed = true;
        await lab.mix();
        feedback6('<span class="ok">Karıştırma tamamlandı. Şimdi pisetle çizgiye kadar tamamla ve onayla.</span>');
        setBusy(false);
    } else if (!GameState.flags.mixed) {
        feedback6('<span class="err">Önce çöz!</span>');
    }
}
function confirmMark() {
    if (GameState.busy) return;
    const task = GameState.currentTask;
    const isLiq = isLiquidTask(task);
    if (!GameState.flags.mixed) {
        feedback6('<span class="err">Önce karıştır!</span>');
        toast(isLiq ? 'Çözelti hazırlama sırasını kontrol et. Önce stok çözeltiyi ekle, sonra karıştır.' : 'Çözelti hazırlama sırasını kontrol et. Önce çöz, sonra karıştır, sonra çizgiye tamamla.', 'err');
        return;
    }
    const v = lab.flaskVolume, t = task.targetVolume;
    const err = (v - t) / t;
    GameState.addedWater = Math.round(v);
    if (Math.abs(err) <= 0.02) {
        feedback6('<span class="ok">Tam çizgide! Son hacim ' + v.toFixed(1) + ' mL.</span>');
        GameState.scores.procedure = 20; GameState.flags.procedureCorrect = true;
    } else if (err < 0) {
        feedback6('<span class="warn">Henüz çizgiye ulaşmadı (' + v.toFixed(1) + ' / ' + t + ' mL). Pisetle su eklemeye devam et.</span>');
        return;
    } else if (err <= 0.06) {
        feedback6('<span class="warn">Çizgiyi biraz geçtin (' + v.toFixed(1) + ' mL). Kabul edilebilir ama daha dikkatli ol.</span>');
        GameState.scores.procedure = 12; GameState.flags.procedureCorrect = true;
    } else {
        feedback6('<span class="err">Çizgiyi geçtin (' + v.toFixed(1) + ' mL)! Çözelti seyreldi, konsantrasyon hedeften düşük.</span>');
        GameState.scores.procedure = 5; GameState.flags.procedureCorrect = false;
    }
    lab.onPour = null;
    setTimeout(() => goToStep(7), 1500);
}

// ===== ADIM 7: SONUÇ =====
function renderStep7(content, task) {
    const isLiq = isLiquidTask(task);
    const target = isLiq ? task.requiredStockVolume : task.requiredMass;
    const unit = isLiq ? ' mL' : ' g';
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : (task.type.indexOf('MOLAR') >= 0 ? ' M' : ' N');
    const measured = isLiq ? GameState.measuredVolume : GameState.measuredMass;
    content.innerHTML = '<h2 class="ok">GÖREV TAMAMLANDI!</h2>' +
        '<div class="info-box left">' +
        '<p><strong>Hedef konsantrasyon:</strong> <span class="ok">' + task.targetConcentration + concUnit + '</span></p>' +
        '<p><strong>Hedef hacim:</strong> <span class="ok">' + task.targetVolume + ' mL</span></p>' +
        '<p><strong>' + (isLiq ? 'Hedef stok hacmi' : 'Hedef kütle') + ':</strong> <span class="ok">' + target.toFixed(2) + unit + '</span></p>' +
        '<p><strong>' + (isLiq ? 'Ölçülen stok hacmi' : 'Ölçülen kütle') + ':</strong> <span class="ok">' + measured.toFixed(2) + unit + '</span></p>' +
        '<p><strong>Son hacim:</strong> <span class="ok">' + GameState.addedWater + ' mL</span></p>' +
        '</div>' +
        '<div class="btn-row"><button class="menu-btn btn-purple inline" onclick="showLabResults()">Sonuçları Gör</button></div>';
}
function goToStep(step) {
    GameState.currentStep = step;
    renderLabStep();
}
function showLabResults() {
    showScreen('results');
    renderResults();
}

// ===== GÜVENLİK LABORATUVARI =====
function renderSafety() {
    const content = $('safety-content');
    if (!GameState.flags.ppeComplete) {
        lab.resetPPE();
        lab.layout('safety');
        content.innerHTML = '<div class="safety-card">' +
            '<h3>Kişisel Koruyucu Donanım (KKD)</h3>' +
            '<p class="muted">Asit deneyine başlamadan önce tüm koruyucu ekipmanları giy!</p>' +
            '<div class="ppe-buttons">' +
            '<button class="ppe-btn" id="ppe-coat" onclick="equipPPE(\'coat\')"><span class="big-emoji">🥼</span><span>Laboratuvar Önlüğü</span></button>' +
            '<button class="ppe-btn" id="ppe-goggles" onclick="equipPPE(\'goggles\')"><span class="big-emoji">🥽</span><span>Koruyucu Gözlük</span></button>' +
            '<button class="ppe-btn" id="ppe-gloves" onclick="equipPPE(\'gloves\')"><span class="big-emoji">🧤</span><span>Eldiven</span></button>' +
            '</div>' +
            '<p id="ppe-status" class="warn bold">Ekipmanları seç...</p>' +
            '</div>';
    } else {
        renderAcidScenario(content);
    }
}
function equipPPE(item) {
    $('ppe-' + item).classList.add('equipped');
    $('ppe-' + item).disabled = true;
    lab.equipPPE(item);
    const allEquipped = ['coat', 'goggles', 'gloves'].every((i) => $('ppe-' + i).classList.contains('equipped'));
    if (allEquipped) {
        $('ppe-status').innerHTML = '<span class="ok">Tüm ekipmanlar giyildi!</span>';
        GameState.flags.ppeComplete = true;
        GameState.scores.safety = 20; GameState.flags.safetyCorrect = true;
        setTimeout(() => renderAcidScenario($('safety-content')), 1000);
    }
}
function renderAcidScenario(content) {
    lab.layout('acid');
    lab.setupAcid();
    content.innerHTML = '<div class="safety-card">' +
        '<h3 class="err">Asit Seyreltme Güvenliği</h3>' +
        '<p>Asit seyreltirken doğru yöntemi seç. UNUTMA: <strong>ASİT SUYA EKLENİR!</strong></p>' +
        '<div class="btn-row">' +
        '<button class="menu-btn btn-red inline" onclick="wrongAcid()">Su → Asit (Tehlikeli)</button>' +
        '<button class="menu-btn btn-green inline" onclick="correctAcid()">Asit → Su (Doğru)</button>' +
        '</div>' +
        '<div id="acid-result"></div></div>';
}
async function wrongAcid() {
    if (GameState.busy) return;
    setBusy(true);
    GameState.scores.safety = Math.max(0, GameState.scores.safety - 20);
    GameState.flags.safetyCorrect = false;
    $('acid-result').innerHTML = '';
    await lab.pourWrong();
    $('acid-result').innerHTML =
        '<div class="warning-box"><strong>Güvenlik Hatası!</strong><br><br>' +
        'Yoğun asidin üzerine doğrudan su eklemek, açığa çıkan ısının suyu hızla ısıtmasına/kaynatmasına ve tehlikeli sıçramalara neden olabilir. ' +
        'Asit seyreltirken uygun güvenlik prosedürünü uygulamalısın.</div>';
    setBusy(false);
}
async function correctAcid() {
    if (GameState.busy) return;
    setBusy(true);
    GameState.flags.acidCorrect = true;
    $('acid-result').innerHTML = '';
    await lab.pourCorrect();
    $('acid-result').innerHTML =
        '<div class="example-box"><strong>Doğru!</strong> Asit yavaş yavaş suya eklenir ve karıştırılır.<br>' +
        'Bu şekilde açığa çıkan ısı güvenli bir şekilde dağıtılır.</div>';
    setBusy(false);
}

// ===== SONUÇLAR =====
function showResults() {
    showScreen('results');
    renderResults();
}
function renderResults() {
    const s = GameState.scores;
    const total = s.calculation + s.equipment + s.measurement + s.procedure + s.safety;
    const status = total >= 80 ? 'Başarılı' : (total >= 60 ? 'Orta' : 'Geliştirilmeli');
    const statusColor = total >= 80 ? '#27ae60' : (total >= 60 ? '#f39c12' : '#e74c3c');
    const line = (k, v, max) => '<div class="score-line"><span class="score-label">' + k + ':</span><span class="score-value ' + getScoreColor(v, max) + '">' + v + ' / ' + max + '</span></div>';
    $('results-content').innerHTML = '<div class="result-card">' +
        line('Hesaplama', s.calculation, 20) + line('Ekipman', s.equipment, 10) + line('Ölçüm', s.measurement, 20) +
        line('Prosedür', s.procedure, 20) + line('Güvenlik', s.safety, 20) +
        '<div class="total-box"><span class="total-label">TOPLAM:</span>' +
        '<span class="total-value" style="color:' + statusColor + '">' + total + ' / 100</span></div>' +
        '<div class="status-text" style="color:' + statusColor + '">Öğrenme Durumu: ' + status + '</div></div>' +
        '<div class="feedback-list">' + getFeedbackItems() + '</div>' +
        '<div class="btn-row">' +
        '<button class="menu-btn btn-orange inline" onclick="retryTask()">Tekrar Dene</button>' +
        '<button class="menu-btn btn-blue inline" onclick="showScreen(\'menu\')">Ana Menü</button>' +
        '</div>';
}
function getScoreColor(score, max) {
    if (score === max) return 'green';
    if (score >= max * 0.7) return 'orange';
    return 'red';
}
function getFeedbackItems() {
    const items = [];
    if (!GameState.flags.calculationCorrect) items.push('Hesaplamada hata yaptın. Formülleri tekrar incele.');
    if (!GameState.flags.equipmentCorrect) items.push('Ekipman seçiminde hata. Doğru ekipmanları seç.');
    if (GameState.scores.measurement < 20) items.push('Ölçüm daha hassas olmalı. Hedefe yakın değer bul.');
    if (!GameState.flags.procedureCorrect) items.push('Prosedür sırasını kontrol et. Önce çöz, sonra karıştır, sonra çizgiye tamamla (çizgiyi geçme!).');
    if (GameState.scores.safety < 20) items.push('Güvenlik hatası! Asit suya eklenir, unutma!');
    if (items.length === 0) items.push('Mükemmel! Tüm adımları doğru tamamladın.');
    return items.map((item) => {
        const color = item.indexOf('Güvenlik') >= 0 ? '#c0392b' : (item.indexOf('Mükemmel') >= 0 ? '#27ae60' : '#e74c3c');
        return '<div class="feedback-item" style="background:' + color + '20;color:' + color + ';">' + item + '</div>';
    }).join('');
}
function retryTask() {
    if (GameState.currentTask) startTask(TASKS.findIndex((t) => t.id === GameState.currentTask.id));
    else showScreen('task-select');
}

// ===== HTML onclick BAĞLANTILARI =====
Object.assign(window, {
    showScreen, showResults, nextLesson, prevLesson, checkPractice, startTask, goToStep,
    checkCalculation, toggleEquipment, checkEquipment, removeMass, confirmMass,
    drawStock, releaseStock, confirmVolume, doTransfer, dissolve, mixSolution, confirmMark,
    showLabResults, equipPPE, wrongAcid, correctAcid, retryTask
});

showScreen('menu');

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
    selectedEquipment: [], taskHistory: []
};

// ===== GÖREV VERİLERİ =====
const TASKS = [
    {
        id: 'TASK_001', title: 'Yuzde Cozelti (Kati-Sivi)',
        description: '100 mL %10 NaCl cozeltisi hazirlayiniz.',
        type: 'PERCENTAGE',
        chemical: { name: 'Sodyum Klorur', formula: 'NaCl', molarMass: 58.44 },
        targetConcentration: 10, targetVolume: 100,
        requiredMass: 10.0, requiredStockVolume: 0, stockConcentration: 0,
        hint: '%10 cozelti = 100 mL cozeltide 10 g cozunen madde',
        explanation: '%10 NaCl: 100 mL icin 10 g NaCl tartilir, balon jojede 100 mL ye tamamlanir.'
    },
    {
        id: 'TASK_002', title: 'Molar Cozelti (Kati-Sivi)',
        description: '250 mL 0.5 M NaCl cozeltisi hazirlayiniz.',
        type: 'MOLAR',
        chemical: { name: 'Sodyum Klorur', formula: 'NaCl', molarMass: 58.44 },
        targetConcentration: 0.5, targetVolume: 250,
        requiredMass: 7.31, requiredStockVolume: 0, stockConcentration: 0,
        hint: 'M = mol/L, mol = M x V(L), kutle = mol x molar kutle',
        explanation: '0.5 M NaCl: 250 mL = 0.250 L, mol = 0.5 x 0.250 = 0.125 mol, kutle = 0.125 x 58.44 = 7.31 g'
    },
    {
        id: 'TASK_003', title: 'Normal Cozelti (Sivi-Sivi)',
        description: '250 mL 0.1 N HCl cozeltisi hazirlayiniz. (Stok: ~12 M HCl)',
        type: 'NORMAL',
        chemical: { name: 'Hidroklorik Asit', formula: 'HCl', molarMass: 36.46 },
        targetConcentration: 0.1, targetVolume: 250,
        requiredMass: 0, requiredStockVolume: 2.08, stockConcentration: 12,
        hint: 'HCl icin 1 M = 1 N. C1V1 = C2V2 formulunu kullan.',
        explanation: '0.1 N HCl: Stok HCl ~12 M. C1V1 = C2V2 => 12 x V1 = 0.1 x 250 => V1 ~ 2.08 mL stok HCl alinir.'
    },
    {
        id: 'TASK_004', title: 'Yuzde Cozelti (Sivi-Sivi)',
        description: '100 mL %30 etanol cozeltisi hazirlayiniz. (Stok: %96 etanol)',
        type: 'PERCENTAGE_LIQUID',
        chemical: { name: 'Etanol', formula: 'C2H5OH', molarMass: 46.07 },
        targetConcentration: 30, targetVolume: 100,
        requiredMass: 0, requiredStockVolume: 31.25, stockConcentration: 96,
        hint: 'C1V1 = C2V2 formulunu kullan. Stok %96 etanoldan al.',
        explanation: '100 mL %30 etanol: 96 x V1 = 30 x 100 => V1 = 31.25 mL stok etanol alinir, 100 mL ye tamamlanir.'
    },
    {
        id: 'TASK_005', title: 'Molar Cozelti (Sivi-Sivi)',
        description: '250 mL 0.1 M H2SO4 cozeltisi hazirlayiniz. (Stok: 1 M H2SO4)',
        type: 'MOLAR_LIQUID',
        chemical: { name: 'Sulfurik Asit', formula: 'H2SO4', molarMass: 98.08 },
        targetConcentration: 0.1, targetVolume: 250,
        requiredMass: 0, requiredStockVolume: 25.0, stockConcentration: 1,
        hint: 'C1V1 = C2V2 formulunu kullan. Stok 1 M H2SO4.',
        explanation: '250 mL 0.1 M H2SO4: 1 x V1 = 0.1 x 250 => V1 = 25 mL stok H2SO4 alinir, 250 mL ye tamamlanir.'
    }
];

const EQUIPMENT_TYPES = [
    { id: 'BALANCE', name: 'Terazi', emoji: '⚖️', desc: 'Kutle olcumu icin hassas terazi' },
    { id: 'SPATULA', name: 'Spatul', emoji: '🥄', desc: 'Kati madde aktarimi icin' },
    { id: 'BEAKER', name: 'Beher', emoji: '🥃', desc: 'Gecici karistirma kabi' },
    { id: 'VOLUMETRIC_FLASK', name: 'Balon Joje', emoji: '🧪', desc: 'Kesin hacimli cozelti hazirlama' },
    { id: 'GRADUATED_CYLINDER', name: 'Mezur', emoji: '📏', desc: 'Yaklasik hacim olcumu' },
    { id: 'PIPETTE', name: 'Pipet', emoji: '💉', desc: 'Kesin hacimli sivi aktarimi' },
    { id: 'DISTILLED_WATER', name: 'Damitik Su', emoji: '💧', desc: 'Cozucu olarak kullanilir' },
    { id: 'REAGENT_BOTTLE', name: 'Reaktif Sisesi', emoji: '🧴', desc: 'Kimyasal madde saklama' },
    { id: 'WASTE_CONTAINER', name: 'Atik Kabi', emoji: '🗑️', desc: 'Atik madde toplama' },
    { id: 'SAFETY_GOGGLES', name: 'Koruyucu Gozluk', emoji: '🥽', desc: 'Goz koruma ekipmani' },
    { id: 'GLOVES', name: 'Eldiven', emoji: '🧤', desc: 'El koruma ekipmani' },
    { id: 'LAB_COAT', name: 'Laboratuvar Onlugu', emoji: '🥼', desc: 'Vucut koruma ekipmani' }
];

function isLiquidTask(task) {
    return task && (task.type === 'PERCENTAGE_LIQUID' || task.type === 'MOLAR_LIQUID' || task.type === 'NORMAL');
}
function isSolidTask(task) {
    return task && (task.type === 'PERCENTAGE' || task.type === 'MOLAR');
}
function getTaskTypeLabel(type) {
    const labels = {
        'PERCENTAGE': 'Yuzde (Kati-Sivi)', 'MOLAR': 'Molar (Kati-Sivi)',
        'NORMAL': 'Normal (Sivi-Sivi)', 'PERCENTAGE_LIQUID': 'Yuzde (Sivi-Sivi)',
        'MOLAR_LIQUID': 'Molar (Sivi-Sivi)'
    };
    return labels[type] || type;
}

// ===== EKRAN YONETIMI =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('screen-' + screenId).classList.add('active');
    GameState.currentScreen = screenId;
    if (screenId === 'tutorial') renderTutorial();
    if (screenId === 'task-select') renderTaskSelect();
    if (screenId === 'safety') renderSafety();
}

// ===== EGITIM MODU =====
const LESSONS = [
    {
        title: 'Ders 1 - Yuzde Cozeltiler (Kati-Sivi)',
        concept: 'Yuzde cozelti, belirli miktardaki cozunen maddenin cozelti hacmine oranidir.',
        formula: '% cozelti = (cozunen madde kutlesi / cozelti hacmi) x 100',
        example: 'Ornek: %10 NaCl, 100 mL\n\n10 g NaCl gerekir ve son hacim 100 mL olmalidir.',
        important: 'ONEMLI: "100 mL su eklemek" ile "cozeltinin son hacmini 100 mL ye tamamlamak" farkli seylerdir!\n\nDogru yontem: Katiyi biraz su ile coz, sonra balon jojeyi cizgisine kadar doldur.',
        practice: { q: '%10 NaCl, 100 mL icin kac g NaCl gerekir?', a: 10.0, unit: 'g', tolerance: 0.5 }
    },
    {
        title: 'Ders 2 - Molar Cozeltiler (Kati-Sivi)',
        concept: 'Molarite (M), bir litre cozeltideki cozunen maddenin mol sayisidir.',
        formula: 'M = mol / L\nmol = M x V(L)\nkutle = mol x molar kutle',
        example: 'Ornek: 0.5 M NaCl, 250 mL\n\nV = 0.250 L\nn = 0.5 x 0.250 = 0.125 mol\nkutle = 0.125 x 58.44 = 7.31 g NaCl',
        important: 'ONEMLI: Hacmi her zaman litreye cevir! 250 mL = 0.250 L\n\nDogru yontem: 7.31 g NaCl tart, balon jojeye aktar, biraz su ile coz, sonra 250 mL cizgisine kadar tamamla.',
        practice: { q: '0.5 M NaCl, 250 mL icin kac g NaCl gerekir?', a: 7.31, unit: 'g', tolerance: 0.37 }
    },
    {
        title: 'Ders 3 - Sivi-Sivi Seyreltme',
        concept: 'Stok cozeltiden daha seyreltik cozelti hazirlamak icin seyreltme formulu kullanilir.',
        formula: 'C1V1 = C2V2\n\nC1 = Stok konsantrasyon\nV1 = Alinacak stok hacmi\nC2 = Hedef konsantrasyon\nV2 = Hedef hacim',
        example: 'Ornek: 100 mL %30 etanol (Stok: %96)\n\n96 x V1 = 30 x 100\nV1 = 3000 / 96 = 31.25 mL stok etanol alinir.',
        important: 'ONEMLI: Sivi-sivi cozeltilerde terazi yerine PIPET veya MEZUR kullanilir!\n\nDogru yontem: Pipetle stoktan al, balon jojeye aktar, suyla tamamla. Asitlerde ASIT SUYA EKLENIR!',
        practice: { q: 'Stok %96 etanoldan 100 mL %30 etanol icin kac mL stok gerekir?', a: 31.25, unit: 'mL', tolerance: 1.5 }
    }
];

function renderTutorial() {
    const lesson = LESSONS[GameState.currentLesson];
    document.getElementById('tutorial-title').textContent = lesson.title;
    document.getElementById('lesson-page').textContent = (GameState.currentLesson + 1) + ' / ' + LESSONS.length;
    document.getElementById('btn-prev').disabled = GameState.currentLesson === 0;
    document.getElementById('btn-next').textContent = GameState.currentLesson === LESSONS.length - 1 ? 'Menuye Don' : 'Sonraki';

    let html = '<h3>' + lesson.title + '</h3>' +
        '<p>' + lesson.concept + '</p>' +
        '<div class="formula-box">' + lesson.formula + '</div>' +
        '<div class="example-box">' + lesson.example.replace(/\n/g, '<br>') + '</div>' +
        '<div class="warning-box">' + lesson.important.replace(/\n/g, '<br>') + '</div>' +
        '<div class="practice-box">' +
        '<h4>Pratik: ' + lesson.practice.q + '</h4>' +
        '<div class="input-row">' +
        '<input type="text" id="practice-input" placeholder="Cevap">' +
        '<span>' + lesson.practice.unit + '</span>' +
        '<button class="btn btn-check" onclick="checkPractice(' + lesson.practice.a + ',' + lesson.practice.tolerance + ')">Kontrol Et</button>' +
        '<button class="btn btn-hint" onclick="showHint(' + GameState.currentLesson + ')">Ipucu</button>' +
        '</div><p id="practice-result"></p></div>';
    document.getElementById('tutorial-content').innerHTML = html;
}

function nextLesson() {
    if (GameState.currentLesson < LESSONS.length - 1) {
        GameState.currentLesson++;
        renderTutorial();
    } else {
        GameState.currentLesson = 0;
        showScreen('menu');
    }
}
function prevLesson() {
    if (GameState.currentLesson > 0) {
        GameState.currentLesson--;
        renderTutorial();
    }
}
function checkPractice(answer, tolerance) {
    const input = document.getElementById('practice-input').value.replace(',', '.');
    const val = parseFloat(input);
    const result = document.getElementById('practice-result');
    if (isNaN(val)) {
        result.innerHTML = '<span style="color:#e74c3c">Gecerli sayi gir.</span>';
        return;
    }
    if (Math.abs(val - answer) <= tolerance) {
        result.innerHTML = '<span style="color:#27ae60">Dogru! Tebrikler.</span>';
    } else {
        result.innerHTML = '<span style="color:#e74c3c">Yaklasik degil. Tekrar dene.</span>';
    }
}
function showHint(index) {
    const hints = [
        '%10 = 100 mL de 10 g',
        'mol = 0.5 x 0.250 = 0.125 mol\nkutle = 0.125 x 58.44',
        '96 x V1 = 30 x 100\nV1 = 3000 / 96'
    ];
    alert('Ipucu: ' + hints[index]);
}

// ===== GOREV SECIMI =====
function renderTaskSelect() {
    const container = document.getElementById('task-list');
    container.innerHTML = TASKS.map(function(task, i) {
        const isLiq = isLiquidTask(task);
        return '<div class="task-card">' +
            '<h3>' + getTaskTypeLabel(task.type) + '</h3>' +
            '<p style="color:#7f8c8d;font-size:0.9rem;margin-bottom:5px;">' + task.chemical.name + ' (' + task.chemical.formula + ')</p>' +
            '<p>' + task.description + '</p>' +
            '<p style="color:#2980b9;font-size:0.85rem;margin-bottom:12px;">' +
            (isLiq ? 'Pipet/Mezur + Balon Joje + Damitik Su' : 'Terazi + Spatul + Balon Joje') +
            '</p>' +
            '<button class="menu-btn btn-blue" style="width:auto;padding:10px 24px;font-size:1rem;" onclick="startTask(' + i + ')">Goreve Basla</button>' +
            '</div>';
    }).join('');
}

function startTask(index) {
    GameState.currentTask = TASKS[index];
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
    showScreen('lab');
    renderLabStep();
}

// ===== LABORATUVAR ADIMLARI =====
function renderLabStep() {
    const task = GameState.currentTask;
    document.getElementById('lab-task-desc').textContent = task.description;
    document.getElementById('lab-step-title').textContent = 'Adim ' + GameState.currentStep + ' / 7';
    const content = document.getElementById('lab-content');
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
    content.innerHTML = '<h3 style="color:#1a5276;margin-bottom:15px;">GOREV: ' + task.description + '</h3>' +
        '<div style="background:#eaf2f8;padding:15px;border-radius:10px;margin-bottom:20px;text-align:left;max-width:500px;margin:0 auto 20px;">' +
        '<p style="margin-bottom:8px;"><strong>Kimyasal:</strong> ' + task.chemical.name + ' (' + task.chemical.formula + ')</p>' +
        '<p style="margin-bottom:8px;"><strong>Hedef:</strong> ' + task.targetVolume + ' mL, ' + task.targetConcentration + concUnit + '</p>' +
        (isLiq ? '<p style="color:#c0392b;"><strong>Stok:</strong> ' + task.stockConcentration + (task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : ' M') + ' ' + task.chemical.name + '</p>' : '') +
        '<p style="color:#7f8c8d;margin-top:10px;">' + (isLiq ? 'Bu bir sivi-sivi seyreltme gorevidir. C1V1 = C2V2 formulunu kullan.' : 'Bu bir kati-sivi cozelti hazirlama gorevidir.') + '</p>' +
        '</div>' +
        '<p style="color:#7f8c8d;margin-bottom:25px;">Once hesaplamani yap, sonra Devam Et butonuna tikla.</p>' +
        '<button class="menu-btn btn-blue" style="width:auto;padding:12px 40px;" onclick="goToStep(2)">Devam Et</button>';
}

function renderStep2(content, task) {
    const isLiq = isLiquidTask(task);
    const unit = isLiq ? 'mL' : 'g';
    const target = isLiq ? task.requiredStockVolume : task.requiredMass;
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : ' M';
    content.innerHTML = '<h3 style="margin-bottom:15px;">Hesaplamani yap ve sonucu gir:</h3>' +
        '<div style="background:#fef9e7;padding:15px;border-radius:10px;margin-bottom:20px;max-width:500px;margin:0 auto 20px;">' +
        '<p style="color:#b7950b;"><strong>Gorev:</strong> ' + task.description + '</p>' +
        (isLiq ?
            '<p style="margin-top:10px;color:#2c3e50;">Stok konsantrasyon: <strong>' + task.stockConcentration + concUnit + '</strong></p>' +
            '<p style="color:#2c3e50;">Hedef: <strong>' + task.targetVolume + ' mL</strong> cozelti</p>' :
            '<p style="margin-top:10px;color:#2c3e50;">Hedef hacim: <strong>' + task.targetVolume + ' mL</strong></p>' +
            '<p style="color:#2c3e50;">Molar kutle: <strong>' + task.chemical.molarMass + ' g/mol</strong></p>') +
        '</div>' +
        '<div class="input-row" style="justify-content:center;">' +
        '<input type="text" id="calc-input" placeholder="Deger" style="width:150px;">' +
        '<span style="font-size:1.1rem;">' + unit + '</span>' +
        '<button class="btn btn-check" onclick="checkCalculation()">Kontrol Et</button>' +
        '<button class="btn btn-hint" onclick="showCalcHint()">Ipucu</button>' +
        '</div>' +
        '<p id="calc-result" style="margin-top:15px;font-size:1.1rem;"></p>';
}

function checkCalculation() {
    const input = document.getElementById('calc-input').value.replace(',', '.');
    const val = parseFloat(input);
    const task = GameState.currentTask;
    const isLiq = isLiquidTask(task);
    const target = isLiq ? task.requiredStockVolume : task.requiredMass;
    const result = document.getElementById('calc-result');
    if (isNaN(val)) {
        result.innerHTML = '<span style="color:#e74c3c">Gecerli sayi gir.</span>';
        return;
    }
    if (Math.abs(val - target) <= target * 0.05) {
        result.innerHTML = '<span style="color:#27ae60">Dogru! ' + val + ' ' + (isLiq ? 'mL' : 'g') + '</span>';
        GameState.scores.calculation = 20;
        GameState.flags.calculationCorrect = true;
        setTimeout(function() { goToStep(3); }, 1000);
    } else {
        result.innerHTML = '<span style="color:#e74c3c">Yaklasik degil. Tekrar dene.</span>';
        GameState.scores.calculation = 0;
    }
}
function showCalcHint() {
    const task = GameState.currentTask;
    if (task.type === 'PERCENTAGE') {
        alert('Ipucu: %' + task.targetConcentration + ' = ' + task.targetVolume + ' mL de ' + (task.targetConcentration * task.targetVolume / 100) + ' g');
    } else if (task.type === 'MOLAR') {
        const moles = task.targetConcentration * (task.targetVolume / 1000);
        const mass = moles * task.chemical.molarMass;
        alert('Ipucu: ' + task.targetConcentration + ' M, ' + task.targetVolume + ' mL icin ' + moles.toFixed(4) + ' mol gerekir. Kutle = ' + mass.toFixed(2) + ' g');
    } else {
        alert('Ipucu: C1V1 = C2V2 => ' + task.stockConcentration + ' x V1 = ' + task.targetConcentration + ' x ' + task.targetVolume);
    }
}

function renderStep3(content, task) {
    const isLiq = isLiquidTask(task);
    content.innerHTML = '<h3 style="margin-bottom:15px;">Bu gorev icin gerekli ekipmanlari sec:</h3>' +
        '<p style="color:#7f8c8d;margin-bottom:15px;">' + (isLiq ? 'Sivi-sivi gorevinde pipet/mezur, balon joje ve damitik su gerekir.' : 'Kati-sivi gorevinde terazi, spatul, balon joje ve damitik su gerekir.') + '</p>' +
        '<div class="equipment-grid" id="eq-grid"></div>' +
        '<button class="menu-btn btn-green" style="width:auto;padding:10px 30px;margin-top:15px;" onclick="checkEquipment()">Ekipmanlari Onayla</button>' +
        '<p id="eq-result" style="margin-top:15px;font-size:1.1rem;"></p>';

    const grid = document.getElementById('eq-grid');
    grid.innerHTML = EQUIPMENT_TYPES.map(function(eq) {
        return '<button class="eq-btn" id="eq-' + eq.id + '" onclick="toggleEquipment(\'' + eq.id + '\')">' + eq.emoji + '<br>' + eq.name + '</button>';
    }).join('');
}

function toggleEquipment(id) {
    const btn = document.getElementById('eq-' + id);
    const idx = GameState.selectedEquipment.indexOf(id);
    if (idx === -1) {
        GameState.selectedEquipment.push(id);
        btn.classList.add('selected');
    } else {
        GameState.selectedEquipment.splice(idx, 1);
        btn.classList.remove('selected');
    }
}

function checkEquipment() {
    const task = GameState.currentTask;
    const isLiq = isLiquidTask(task);
    const result = document.getElementById('eq-result');
    let hasRequired = true;
    let missing = [];

    if (isLiq) {
        const hasPipet = GameState.selectedEquipment.indexOf('PIPETTE') >= 0;
        const hasCylinder = GameState.selectedEquipment.indexOf('GRADUATED_CYLINDER') >= 0;
        const hasFlask = GameState.selectedEquipment.indexOf('VOLUMETRIC_FLASK') >= 0;
        const hasWater = GameState.selectedEquipment.indexOf('DISTILLED_WATER') >= 0;
        if (!hasPipet && !hasCylinder) { missing.push('Pipet veya Mezur'); hasRequired = false; }
        if (!hasFlask) { missing.push('Balon Joje'); hasRequired = false; }
        if (!hasWater) { missing.push('Damitik Su'); hasRequired = false; }
    } else {
        const hasBalance = GameState.selectedEquipment.indexOf('BALANCE') >= 0;
        const hasSpatula = GameState.selectedEquipment.indexOf('SPATULA') >= 0;
        const hasFlask = GameState.selectedEquipment.indexOf('VOLUMETRIC_FLASK') >= 0;
        const hasWater = GameState.selectedEquipment.indexOf('DISTILLED_WATER') >= 0;
        if (!hasBalance) { missing.push('Terazi'); hasRequired = false; }
        if (!hasSpatula) { missing.push('Spatul'); hasRequired = false; }
        if (!hasFlask) { missing.push('Balon Joje'); hasRequired = false; }
        if (!hasWater) { missing.push('Damitik Su'); hasRequired = false; }
    }

    if (hasRequired) {
        result.innerHTML = '<span style="color:#27ae60">Dogru ekipmanlar secildi!</span>';
        GameState.scores.equipment = 10;
        GameState.flags.equipmentCorrect = true;
        setTimeout(function() { goToStep(4); }, 1000);
    } else {
        result.innerHTML = '<span style="color:#e74c3c">Eksik ekipman: ' + missing.join(', ') + '</span>';
        alert(isLiq
            ? 'Bu islem icin uygun ekipmani secmedin. Pipet/Mezur, Balon Joje ve Damitik Su kullanmalisin.'
            : 'Bu islem icin uygun ekipmani secmedin. Terazi, Spatul, Balon Joje ve Damitik Su kullanmalisin.');
    }
}

// ===== ADIM 4: TART veya HACIM OLÇ =====
function renderStep4(content, task) {
    if (isLiquidTask(task)) {
        renderStep4Liquid(content, task);
    } else {
        renderStep4Solid(content, task);
    }
}

function renderStep4Solid(content, task) {
    const target = task.requiredMass;
    content.innerHTML = '<h3 style="margin-bottom:15px;">Terazi - Hedef: ' + target.toFixed(2) + ' g</h3>' +
        '<p style="color:#7f8c8d;margin-bottom:10px;">Spatul ile NaCl ekle/cikar, hedefe ulas.</p>' +
        '<div class="balance-display"><span class="value" id="mass-display">0.00 g</span></div>' +
        '<div style="display:flex;gap:15px;justify-content:center;margin:20px 0;flex-wrap:wrap;">' +
        '<button class="menu-btn btn-orange" style="width:auto;padding:10px 20px;" onclick="addMass()">Spatul ile Ekle</button>' +
        '<button class="menu-btn btn-gray" style="width:auto;padding:10px 20px;" onclick="removeMass()">Azalt</button>' +
        '<button class="menu-btn btn-green" style="width:auto;padding:10px 20px;" onclick="confirmMass()">Tartimi Onayla</button>' +
        '</div>' +
        '<p id="mass-result" style="font-size:1.1rem;"></p>';
}

function renderStep4Liquid(content, task) {
    const target = task.requiredStockVolume;
    const stockConc = task.stockConcentration;
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? '%' : 'M';
    content.innerHTML = '<h3 style="margin-bottom:15px;">Pipetle Stoktan Al - Hedef: ' + target.toFixed(2) + ' mL</h3>' +
        '<p style="color:#7f8c8d;margin-bottom:10px;">Stok: ' + stockConc + concUnit + ' ' + task.chemical.name + ' -> Balon Jojeye aktar</p>' +
        '<div style="display:flex;justify-content:center;gap:40px;margin:20px 0;flex-wrap:wrap;">' +
        '<div style="text-align:center;">' +
        '<div style="width:60px;height:120px;border:3px solid #8e44ad;border-radius:0 0 15px 15px;background:#f5eef8;margin:0 auto;position:relative;overflow:hidden;">' +
        '<div id="pipet-liquid" style="position:absolute;bottom:0;left:0;right:0;background:#9b59b6;transition:height 0.3s;height:0px;"></div></div>' +
        '<p style="margin-top:8px;color:#8e44ad;font-weight:bold;">Pipet</p>' +
        '<p id="pipet-volume" style="font-size:0.9rem;color:#7f8c8d;">0.00 mL</p></div>' +
        '<div style="display:flex;align-items:center;font-size:2rem;color:#7f8c8d;">-></div>' +
        '<div style="text-align:center;">' +
        '<div style="width:80px;height:120px;border:3px solid #2980b9;border-radius:0 0 20px 20px;background:#eaf2f8;margin:0 auto;position:relative;overflow:hidden;">' +
        '<div id="flask-stock" style="position:absolute;bottom:0;left:0;right:0;background:#85c1e9;transition:height 0.3s;height:0px;"></div></div>' +
        '<p style="margin-top:8px;color:#2980b9;font-weight:bold;">Balon Joje</p>' +
        '<p id="flask-stock-vol" style="font-size:0.9rem;color:#7f8c8d;">0.00 mL</p></div></div>' +
        '<div style="display:flex;gap:15px;justify-content:center;margin:20px 0;flex-wrap:wrap;">' +
        '<button class="menu-btn btn-purple" style="width:auto;padding:10px 20px;" onclick="drawStock()">Pipetle Cek</button>' +
        '<button class="menu-btn btn-orange" style="width:auto;padding:10px 20px;" onclick="releaseStock()">Jojeye Birak</button>' +
        '<button class="menu-btn btn-green" style="width:auto;padding:10px 20px;" onclick="confirmVolume()">Hacmi Onayla</button>' +
        '</div>' +
        '<p id="volume-result" style="font-size:1.1rem;"></p>';
}

function addMass() {
    GameState.measuredMass += 0.5 + Math.random() * 1.5;
    document.getElementById('mass-display').textContent = GameState.measuredMass.toFixed(2) + ' g';
}
function removeMass() {
    GameState.measuredMass = Math.max(0, GameState.measuredMass - 0.5);
    document.getElementById('mass-display').textContent = GameState.measuredMass.toFixed(2) + ' g';
}
function confirmMass() {
    const task = GameState.currentTask;
    const target = task.requiredMass;
    const accuracy = Math.max(0, 1.0 - Math.abs(GameState.measuredMass - target) / target);
    const result = document.getElementById('mass-result');
    if (accuracy >= 0.95) {
        result.innerHTML = '<span style="color:#27ae60">Mukemmel tartim!</span>';
        GameState.scores.measurement = 20; GameState.flags.measurementCorrect = true;
        setTimeout(function() { goToStep(5); }, 1000);
    } else if (accuracy >= 0.80) {
        result.innerHTML = '<span style="color:#f39c12">Kabul edilebilir, ama daha hassas olabilirsin.</span>';
        GameState.scores.measurement = accuracy >= 0.90 ? 15 : (accuracy >= 0.85 ? 12 : 10);
        GameState.flags.measurementCorrect = true;
        setTimeout(function() { goToStep(5); }, 1500);
    } else {
        result.innerHTML = '<span style="color:#e74c3c">Madde miktari hedef degerden uzak. Hesaplamani kontrol et.</span>';
        GameState.scores.measurement = 5;
    }
}

function drawStock() {
    GameState.measuredVolume += 0.5 + Math.random() * 2.0;
    const h = Math.min(100, GameState.measuredVolume * 2);
    document.getElementById('pipet-liquid').style.height = h + 'px';
    document.getElementById('pipet-volume').textContent = GameState.measuredVolume.toFixed(2) + ' mL';
}
function releaseStock() {
    if (GameState.measuredVolume > 0) {
        const flaskVol = GameState.measuredVolume;
        const h = Math.min(100, flaskVol * 1.5);
        document.getElementById('flask-stock').style.height = h + 'px';
        document.getElementById('flask-stock-vol').textContent = flaskVol.toFixed(2) + ' mL';
        document.getElementById('pipet-liquid').style.height = '0px';
        document.getElementById('pipet-volume').textContent = '0.00 mL';
    }
}
function confirmVolume() {
    const task = GameState.currentTask;
    const target = task.requiredStockVolume;
    const accuracy = Math.max(0, 1.0 - Math.abs(GameState.measuredVolume - target) / target);
    const result = document.getElementById('volume-result');
    if (accuracy >= 0.95) {
        result.innerHTML = '<span style="color:#27ae60">Mukemmel hacim olcumu!</span>';
        GameState.scores.measurement = 20; GameState.flags.measurementCorrect = true;
        setTimeout(function() { goToStep(5); }, 1000);
    } else if (accuracy >= 0.80) {
        result.innerHTML = '<span style="color:#f39c12">Kabul edilebilir, ama daha hassas olabilirsin.</span>';
        GameState.scores.measurement = accuracy >= 0.90 ? 15 : (accuracy >= 0.85 ? 12 : 10);
        GameState.flags.measurementCorrect = true;
        setTimeout(function() { goToStep(5); }, 1500);
    } else {
        result.innerHTML = '<span style="color:#e74c3c">Hacim hedef degerden uzak. Tekrar olc.</span>';
        GameState.scores.measurement = 5;
    }
}

// ===== ADIM 5: AKTAR =====
function renderStep5(content, task) {
    const isLiq = isLiquidTask(task);
    content.innerHTML = '<h3 style="margin-bottom:20px;">' + (isLiq ? 'Stok Cozeltiyi Balon Jojeye Aktar' : 'Katiyi Balon Jojeye Aktar') + '</h3>' +
        '<div style="display:flex;justify-content:center;margin:20px 0;">' +
        '<div style="text-align:center;">' +
        '<div style="width:80px;height:120px;border:3px solid #2980b9;border-radius:0 0 20px 20px;background:#aed6f1;margin:0 auto;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;">' +
        '<span style="color:#1a5276;font-size:0.8rem;">Balon Joje</span></div></div></div>' +
        '<button class="menu-btn btn-orange" style="width:auto;padding:12px 30px;" id="transfer-btn" onclick="doTransfer()">' + (isLiq ? 'Stok Cozeltiyi Aktar' : 'Spatul ile Aktar') + '</button>' +
        '<div id="transfer-result"></div>';
}
function doTransfer() {
    const btn = document.getElementById('transfer-btn');
    btn.disabled = true; btn.textContent = 'Aktariliyor...';
    setTimeout(function() {
        document.getElementById('transfer-result').innerHTML =
            '<p style="color:#27ae60;font-size:1.2rem;font-weight:bold;margin:15px 0;">Aktarim tamamlandi!</p>' +
            '<button class="menu-btn btn-blue" style="width:auto;padding:10px 30px;" onclick="goToStep(6)">Devam Et</button>';
    }, 1500);
}

// ===== ADIM 6: SU EKLE =====
function renderStep6(content, task) {
    const isLiq = isLiquidTask(task);
    content.innerHTML = '<h3 style="margin-bottom:15px;">Damitik Su Ekleme</h3>' +
        '<div class="flask-container"><div class="flask" id="flask"><div class="flask-water" id="flask-water" style="height:0px;"></div></div></div>' +
        '<p id="volume-label" style="font-size:1.1rem;margin-bottom:15px;">Hacim: 0 mL</p>' +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:15px 0;">' +
        '<button class="btn btn-blue" onclick="addSomeWater()">Biraz Su Ekle</button>' +
        (isLiq ? '' : '<button class="btn" style="background:#9b59b6;" onclick="dissolve()">Coz</button>') +
        '<button class="btn btn-orange" onclick="mixSolution()">Karistir</button>' +
        '<button class="btn btn-green" onclick="addToMark()">Cizgiye Tamamla</button>' +
        '</div>' +
        '<p id="step6-feedback" style="font-size:1rem;color:#7f8c8d;">' + (isLiq ? 'Once biraz su ekle, sonra karistir.' : 'Once biraz su ekle, sonra coz.') + '</p>';
}
function addSomeWater() {
    const isLiq = isLiquidTask(GameState.currentTask);
    if (!GameState.flags.dissolved || isLiq) {
        GameState.addedWater += 30;
        document.getElementById('flask-water').style.height = GameState.addedWater + 'px';
        document.getElementById('volume-label').textContent = 'Hacim: ~' + GameState.addedWater + ' mL';
        const fb = document.getElementById('step6-feedback');
        fb.innerHTML = isLiq ? 'Simdi karistir.' : 'Simdi cozeltiyi coz.';
        fb.style.color = '#2980b9';
    }
}
function dissolve() {
    if (GameState.addedWater > 0 && !GameState.flags.dissolved) {
        GameState.flags.dissolved = true;
        document.getElementById('flask-water').classList.add('dissolved');
        document.getElementById('step6-feedback').innerHTML = '<span style="color:#27ae60">Cozelti cozuldu. Simdi karistir.</span>';
    }
}
function mixSolution() {
    const isLiq = isLiquidTask(GameState.currentTask);
    if ((GameState.flags.dissolved || isLiq) && !GameState.flags.mixed) {
        GameState.flags.mixed = true;
        const flask = document.getElementById('flask');
        flask.classList.add('shake');
        setTimeout(function() { flask.classList.remove('shake'); }, 500);
        document.getElementById('step6-feedback').innerHTML = '<span style="color:#27ae60">Karistirma tamamlandi. Simdi cizgiye tamamla.</span>';
    }
}
function addToMark() {
    const isLiq = isLiquidTask(GameState.currentTask);
    if (GameState.flags.mixed) {
        const task = GameState.currentTask;
        document.getElementById('flask-water').style.height = task.targetVolume + 'px';
        document.getElementById('volume-label').textContent = 'Hacim: ' + task.targetVolume + ' mL';
        GameState.addedWater = task.targetVolume;
        document.getElementById('step6-feedback').innerHTML = '<span style="color:#27ae60">Son hacim ayarlandi!</span>';
        GameState.scores.procedure = 20; GameState.flags.procedureCorrect = true;
        setTimeout(function() { goToStep(7); }, 1000);
    } else {
        document.getElementById('step6-feedback').innerHTML = '<span style="color:#e74c3c">Once karistir!</span>';
        alert(isLiq ? 'Cozelti hazirlama sirasini kontrol et. Once stok cozeltiyi ekle, sonra karistir.' : 'Cozelti hazirlama sirasini kontrol et. Once katiyi tart, sonra balon jojeye aktar.');
    }
}

// ===== ADIM 7: SONUC =====
function renderStep7(content, task) {
    const isLiq = isLiquidTask(task);
    const target = isLiq ? task.requiredStockVolume : task.requiredMass;
    const unit = isLiq ? ' mL' : ' g';
    const concUnit = task.type.indexOf('PERCENTAGE') >= 0 ? ' %' : (task.type.indexOf('MOLAR') >= 0 ? ' M' : ' N');
    const measured = isLiq ? GameState.measuredVolume : GameState.measuredMass;
    content.innerHTML = '<h2 style="color:#27ae60;margin-bottom:20px;">GOREV TAMAMLANDI!</h2>' +
        '<div style="text-align:left;max-width:450px;margin:0 auto;background:#f8f9fa;padding:20px;border-radius:12px;">' +
        '<p><strong>Hedef konsantrasyon:</strong> <span style="color:#27ae60;">' + task.targetConcentration + concUnit + '</span></p>' +
        '<p><strong>Hedef hacim:</strong> <span style="color:#27ae60;">' + task.targetVolume + ' mL</span></p>' +
        '<p><strong>' + (isLiq ? 'Hedef stok hacmi' : 'Hedef kutle') + ':</strong> <span style="color:#27ae60;">' + target.toFixed(2) + unit + '</span></p>' +
        '<p><strong>' + (isLiq ? 'Olculen stok hacmi' : 'Olculen kutle') + ':</strong> <span style="color:#27ae60;">' + measured.toFixed(2) + unit + '</span></p>' +
        '<p><strong>Son hacim:</strong> <span style="color:#27ae60;">' + GameState.addedWater + ' mL</span></p>' +
        '</div>' +
        '<button class="menu-btn btn-purple" style="width:auto;padding:12px 40px;margin-top:25px;" onclick="showLabResults()">Sonuclari Gor</button>';
}
function goToStep(step) {
    GameState.currentStep = step;
    renderLabStep();
}
function showLabResults() {
    showScreen('results');
    renderResults();
}

// ===== GUVENLIK LABORATUVARI =====
function renderSafety() {
    const content = document.getElementById('safety-content');
    if (!GameState.flags.ppeComplete) {
        content.innerHTML = '<div class="safety-card">' +
            '<h3 style="color:#2c3e50;margin-bottom:10px;">Kisisel Koruyucu Donanim (KKD)</h3>' +
            '<p style="color:#7f8c8d;margin-bottom:20px;">Asit deneyine baslamadan once tum koruyucu ekipmanlari giy!</p>' +
            '<div class="ppe-buttons">' +
            '<button class="ppe-btn" id="ppe-coat" onclick="equipPPE(\'coat\')"><span style="font-size:2rem;">🥼</span><span>Laboratuvar Onlugu</span></button>' +
            '<button class="ppe-btn" id="ppe-goggles" onclick="equipPPE(\'goggles\')"><span style="font-size:2rem;">🥽</span><span>Koruyucu Gozluk</span></button>' +
            '<button class="ppe-btn" id="ppe-gloves" onclick="equipPPE(\'gloves\')"><span style="font-size:2rem;">🧤</span><span>Eldiven</span></button>' +
            '</div>' +
            '<p id="ppe-status" style="color:#f39c12;font-weight:bold;margin-top:15px;">Ekipmanlari sec...</p>' +
            '</div>';
    } else {
        renderAcidScenario(content);
    }
}
function equipPPE(item) {
    document.getElementById('ppe-' + item).classList.add('equipped');
    document.getElementById('ppe-' + item).disabled = true;
    const allEquipped = document.getElementById('ppe-coat').classList.contains('equipped') &&
        document.getElementById('ppe-goggles').classList.contains('equipped') &&
        document.getElementById('ppe-gloves').classList.contains('equipped');
    if (allEquipped) {
        document.getElementById('ppe-status').innerHTML = '<span style="color:#27ae60">Tum ekipmanlar giyildi!</span>';
        GameState.flags.ppeComplete = true;
        GameState.scores.safety = 20; GameState.flags.safetyCorrect = true;
        setTimeout(function() { renderAcidScenario(document.getElementById('safety-content')); }, 1000);
    }
}
function renderAcidScenario(content) {
    content.innerHTML = '<div class="safety-card">' +
        '<h3 style="color:#c0392b;margin-bottom:10px;">Asit Seyreltme Guvenligi</h3>' +
        '<p style="color:#2c3e50;margin-bottom:20px;">Asit seyreltirken dogru yontemi sec. UNUTMA: <strong>ASIT SUYA EKLENIR!</strong></p>' +
        '<div style="display:flex;justify-content:center;margin:20px 0;">' +
        '<div style="width:120px;height:100px;border:3px solid #2980b9;border-radius:0 0 15px 15px;background:#eaf2f8;display:flex;align-items:center;justify-content:center;">' +
        '<span style="color:#7f8c8d;">Beher</span></div></div>' +
        '<div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin:20px 0;">' +
        '<button class="menu-btn btn-red" style="width:auto;padding:10px 20px;" onclick="wrongAcid()">Su -> Asit (Tehlikeli)</button>' +
        '<button class="menu-btn btn-green" style="width:auto;padding:10px 20px;" onclick="correctAcid()">Asit -> Su (Dogru)</button>' +
        '</div>' +
        '<div id="acid-result" style="margin-top:15px;"></div></div>';
}
function wrongAcid() {
    GameState.scores.safety = Math.max(0, GameState.scores.safety - 20);
    GameState.flags.safetyCorrect = false;
    document.getElementById('acid-result').innerHTML =
        '<div class="warning-box"><strong>Guvenlik Hatasi!</strong><br><br>' +
        'Yogun asidin uzerine dogrudan su eklemek, aciga cikan isinin suyu hizla isitmasina/kaynatmasina ve tehlikeli sicramalara neden olabilir. ' +
        'Asit seyreltirken uygun guvenlik prosedurunu uygulamalisin.</div>';
}
function correctAcid() {
    GameState.flags.acidCorrect = true;
    document.getElementById('acid-result').innerHTML =
        '<div class="example-box"><strong>Dogru!</strong> Asit yavas yavas suya eklenir ve karistirilir.<br>' +
        'Bu sekilde aciga cikan isi guvenli bir sekilde dagitilir.</div>';
}

// ===== SONUCLAR =====
function showResults() {
    showScreen('results');
    renderResults();
}
function renderResults() {
    const total = GameState.scores.calculation + GameState.scores.equipment + GameState.scores.measurement +
                  GameState.scores.procedure + GameState.scores.safety;
    const status = total >= 80 ? 'Basarili' : (total >= 60 ? 'Orta' : 'Gelistirilmeli');
    const statusColor = total >= 80 ? '#27ae60' : (total >= 60 ? '#f39c12' : '#e74c3c');
    const content = document.getElementById('results-content');
    content.innerHTML = '<div class="result-card">' +
        '<div class="score-line"><span class="score-label">Hesaplama:</span>' +
        '<span class="score-value ' + getScoreColor(GameState.scores.calculation, 20) + '">' + GameState.scores.calculation + ' / 20</span></div>' +
        '<div class="score-line"><span class="score-label">Ekipman:</span>' +
        '<span class="score-value ' + getScoreColor(GameState.scores.equipment, 10) + '">' + GameState.scores.equipment + ' / 10</span></div>' +
        '<div class="score-line"><span class="score-label">Olcum:</span>' +
        '<span class="score-value ' + getScoreColor(GameState.scores.measurement, 20) + '">' + GameState.scores.measurement + ' / 20</span></div>' +
        '<div class="score-line"><span class="score-label">Prosedur:</span>' +
        '<span class="score-value ' + getScoreColor(GameState.scores.procedure, 20) + '">' + GameState.scores.procedure + ' / 20</span></div>' +
        '<div class="score-line"><span class="score-label">Guvenlik:</span>' +
        '<span class="score-value ' + getScoreColor(GameState.scores.safety, 20) + '">' + GameState.scores.safety + ' / 20</span></div>' +
        '<div class="total-box"><span class="total-label">TOPLAM:</span>' +
        '<span class="total-value" style="color:' + statusColor + '">' + total + ' / 100</span></div>' +
        '<div class="status-text" style="color:' + statusColor + '">Ogrenme Durumu: ' + status + '</div></div>' +
        '<div style="max-width:500px;width:100%;margin-top:15px;">' + getFeedbackItems() + '</div>' +
        '<div style="display:flex;gap:15px;justify-content:center;margin-top:20px;flex-wrap:wrap;">' +
        '<button class="menu-btn btn-orange" style="width:auto;padding:10px 25px;" onclick="retryTask()">Tekrar Dene</button>' +
        '<button class="menu-btn btn-blue" style="width:auto;padding:10px 25px;" onclick="showScreen(\'menu\')">Ana Menu</button>' +
        '</div>';
}
function getScoreColor(score, max) {
    if (score === max) return 'green';
    if (score >= max * 0.7) return 'orange';
    return 'red';
}
function getFeedbackItems() {
    let items = [];
    if (!GameState.flags.calculationCorrect) items.push('Hesaplamada hata yaptin. Formulleri tekrar incele.');
    if (!GameState.flags.equipmentCorrect) items.push('Ekipman seciminde hata. Dogru ekipmanlari sec.');
    if (GameState.scores.measurement < 20) items.push('Olcum daha hassas olmali. Hedefe yakin deger bul.');
    if (!GameState.flags.procedureCorrect) items.push('Prosedur sirasini kontrol et. Once coz, sonra karistir, sonra tamamla.');
    if (GameState.scores.safety < 20) items.push('Guvenlik hatasi! Asit suya eklenir, unutma!');
    if (items.length === 0) items.push('Mukemmel! Tum adimlari dogru tamamladin.');
    return items.map(function(item) {
        const color = item.indexOf('Guvenlik') >= 0 ? '#c0392b' : (item.indexOf('Mukemmel') >= 0 ? '#27ae60' : '#e74c3c');
        return '<div class="feedback-item" style="background:' + color + '20;color:' + color + ';">' + item + '</div>';
    }).join('');
}
function retryTask() {
    if (GameState.currentTask) {
        const idx = TASKS.findIndex(function(t) { return t.id === GameState.currentTask.id; });
        startTask(idx);
    } else {
        showScreen('task-select');
    }
}

// ===== BASLAT =====
window.onload = function() {
    showScreen('menu');
};

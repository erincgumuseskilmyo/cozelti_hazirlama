// ===== 3D LABORATUVAR: three.js (cel-shading) + cannon-es (fizik) + Blender GLB modelleri =====
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const INK = 0x1b1b2f;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k);

// Blender'da uretilen modeller (models/*.glb)
const MODEL_NAMES = ['flask', 'beaker', 'pipette', 'wash_bottle', 'spatula', 'balance', 'weigh_boat',
    'graduated_cylinder', 'reagent_bottle', 'waste_bin', 'salt_jar', 'goggles', 'gloves', 'lab_coat'];

// ---- Cel-shading yardimcilari ----
function makeGradientMap() {
    const data = new Uint8Array([70, 140, 205, 255]);
    const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
}
const GRADIENT = makeGradientMap();

const OUTLINE_VERT = `
uniform float thickness;
void main() {
    vec3 p = position + normal * thickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const OUTLINE_FRAG = `
uniform vec3 color;
void main() { gl_FragColor = vec4(color, 1.0); }`;
const outlineMats = {};
function outlineMaterial(thickness) {
    const key = thickness.toFixed(4);
    if (!outlineMats[key]) {
        outlineMats[key] = new THREE.ShaderMaterial({
            uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(INK) } },
            vertexShader: OUTLINE_VERT, fragmentShader: OUTLINE_FRAG, side: THREE.BackSide
        });
    }
    return outlineMats[key];
}
// Cam icin: ters-hull yerine fresnel tabanli koyu kenar (icini karartmaz)
function addGlassRim(mat) {
    mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
            #include <dithering_fragment>
            float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.5);
            float rim = smoothstep(0.32, 0.5, fres);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.106, 0.106, 0.184), rim);
            gl_FragColor.a = mix(gl_FragColor.a, 1.0, rim);
        `);
    };
    mat.customProgramCacheKey = () => 'glassrim';
}
function toonMaterial(color, opts = {}) {
    const mat = new THREE.MeshToonMaterial({
        color, gradientMap: GRADIENT,
        transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
        side: opts.side ?? THREE.FrontSide,
        depthWrite: opts.depthWrite ?? true
    });
    if (opts.clippingPlanes) mat.clippingPlanes = opts.clippingPlanes;
    if (opts.glass) addGlassRim(mat);
    mat.userData.opts = opts;
    return mat;
}
function cloneMaterial(m) {
    return toonMaterial(m.color.getHex(), m.userData.opts || {});
}
// Dis cizgi hull'u: yumusak normallerle disari itilmis arka yuz
function addOutline(mesh, thickness) {
    const g = mesh.geometry.clone();
    g.deleteAttribute('normal'); g.deleteAttribute('uv'); g.deleteAttribute('uv1');
    const og = mergeVertices(g, 1e-4);
    og.computeVertexNormals();
    const o = new THREE.Mesh(og, outlineMaterial(thickness));
    o.raycast = () => {};
    o.name = 'outline';
    mesh.add(o);
}

export function toon(geometry, color, opts = {}) {
    const mat = toonMaterial(color, opts);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = opts.shadow !== false;
    mesh.receiveShadow = true;
    if (opts.renderOrder !== undefined) mesh.renderOrder = opts.renderOrder;
    if (opts.outline !== false && !opts.glass) addOutline(mesh, opts.thickness ?? 0.03);
    return mesh;
}
function label(text, cls = '') {
    const div = document.createElement('div');
    div.className = 'lbl ' + cls;
    div.textContent = text;
    const o = new CSS2DObject(div);
    o.element.style.display = 'none';
    return o;
}
// GLB'den gelen PBR malzemeleri toon + dis cizgiye cevir
function convertModel(root) {
    const meshes = [];
    root.traverse((m) => { if (m.isMesh) meshes.push(m); });
    meshes.forEach((m) => {
        const src = m.material;
        const name = (src.name || '').toLowerCase();
        const color = src.color ? src.color.getHex() : 0xffffff;
        if (name.startsWith('glass')) {
            m.material = toonMaterial(0xcfeaff, { glass: true, transparent: true, opacity: 0.5, depthWrite: false });
            m.renderOrder = 2; m.castShadow = false;
        } else if (name === 'lens') {
            m.material = toonMaterial(color, { transparent: true, opacity: 0.7, side: THREE.DoubleSide });
            m.castShadow = false;
        } else {
            m.material = toonMaterial(color);
            m.castShadow = true;
            addOutline(m, 0.015);
        }
        m.receiveShadow = true;
    });
    // Blender +Y (arka) -> three -z olacak sekilde 180 derece cevir
    const wrap = new THREE.Group();
    root.rotation.y = Math.PI;
    wrap.add(root);
    return wrap;
}
async function loadModels() {
    const loader = new GLTFLoader();
    const out = {};
    await Promise.all(MODEL_NAMES.map((n) => new Promise((res, rej) => {
        loader.load('models/' + n + '.glb', (gltf) => { out[n] = convertModel(gltf.scene); res(); }, undefined, rej);
    })));
    return out;
}

// ---- Fizik sekil yardimcilari ----
function addRing(body, n, radius, y, halfH, halfW, tilt, thick = 0.02) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const pos = new CANNON.Vec3(Math.cos(a) * radius, y, Math.sin(a) * radius);
        const qYaw = new CANNON.Quaternion().setFromEuler(0, -a, 0);
        const qTilt = new CANNON.Quaternion().setFromEuler(0, 0, tilt);
        const q = qYaw.mult(qTilt);
        body.addShape(new CANNON.Box(new CANNON.Vec3(thick, halfH, halfW)), pos, q);
    }
}
function addFloor(body, half, y) {
    body.addShape(new CANNON.Box(new CANNON.Vec3(half, 0.02, half)), new CANNON.Vec3(0, y, 0));
}

const VIEWS = {
    idle:      { pos: [0, 4.2, 9.5],   target: [0, 1.0, 0] },
    equipment: { pos: [0, 3.6, 7.2],   target: [0, 1.75, -0.9] },
    weigh:     { pos: [-1.6, 3.4, 4.8], target: [-1.8, 0.5, 0.7] },
    pipette:   { pos: [1.6, 2.6, 4.4], target: [1.6, 1.4, 0.3] },
    transfer:  { pos: [-1.0, 2.8, 4.4], target: [-1.0, 1.3, 0.3] },
    water:     { pos: [1.3, 3.0, 4.6], target: [1.2, 1.3, 0.4] },
    acid:      { pos: [0, 2.6, 4.2],   target: [0, 1.2, 0.3] },
    done:      { pos: [-0.2, 2.4, 3.6], target: [-0.2, 1.3, 0.3] },
    safety:    { pos: [0, 3.4, 4.6],   target: [0, 0.9, -1.0] }
};

export class Lab3D {
    static async create(container) {
        const models = await loadModels();
        return new Lab3D(container, models);
    }

    constructor(container, models) {
        this.container = container;
        this.modelsRaw = models;
        const w = container.clientWidth || window.innerWidth || 1280, h = container.clientHeight || window.innerHeight || 720;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x9ed7f5);
        this.scene.fog = new THREE.Fog(0x9ed7f5, 20, 45);

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        this.camera.position.set(...VIEWS.idle.pos);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(w, h);
        this.renderer.localClippingEnabled = true;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        container.appendChild(this.renderer.domElement);

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(w, h);
        Object.assign(this.labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
        container.appendChild(this.labelRenderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(...VIEWS.idle.target);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 18;
        this.controls.maxPolarAngle = 1.5;
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = 0.6;

        // Fizik dunyasi
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;
        this.world.defaultContactMaterial.friction = 0.35;
        this.world.defaultContactMaterial.restitution = 0.02;
        this.world.solver.iterations = 6;

        this.dynamics = [];
        this.grains = [];
        this.flaskGrains = [];
        this.droplets = [];
        this.tweens = [];
        this.pickables = [];
        this.draggables = [];
        this.selected = new Set();
        this.mode = 'idle';
        this.onPick = null;
        this.onTick = null;
        this.onPour = null;
        this.flaskStockVol = 0;
        this.flaskWaterVol = 0;
        this.flaskMaxVol = 100;
        this.flaskLevelY = 0.06;
        this.stockColor = 0xf7e07e;
        this.dissolvedColor = 0xa8dcf7;
        this.grainColor = 0xfafafa;
        this.beakerVol = 60;
        this.beakerLevelY = 0.4;
        this.waterPerDrop = 1;
        this.squeezing = false;
        this.dropTimer = 0;

        this.grainShape = new CANNON.Sphere(0.024);
        this.dropShape = new CANNON.Sphere(0.04);
        this.templates = {};
        this.buildGrainPool();

        this.buildEnvironment();
        this.buildProps();
        this.buildPPE();
        this.buildEquipmentShelf();
        this.setupPointer();
        this.layout('idle');

        window.addEventListener('resize', () => this.onResize());
        this.clock = new THREE.Clock();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    onResize() {
        const w = this.container.clientWidth, h = this.container.clientHeight;
        if (!w || !h) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.labelRenderer.setSize(w, h);
    }

    // GLB modelinin bagimsiz malzemeli kopyasi
    model(name) {
        const c = this.modelsRaw[name].clone();
        c.traverse((m) => {
            if (m.isMesh && m.name !== 'outline' && m.material && m.material.isMeshToonMaterial) m.material = cloneMaterial(m.material);
        });
        return c;
    }

    // ================= ORTAM =================
    buildEnvironment() {
        const s = this.scene;
        s.add(new THREE.HemisphereLight(0xffffff, 0x6f8fb0, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 1.4);
        sun.position.set(5, 10, 7);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
        sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
        sun.shadow.bias = -0.003;
        s.add(sun);

        const floor = toon(new THREE.BoxGeometry(40, 0.2, 30), 0x7f93ab, { outline: false });
        floor.position.y = -1.6; s.add(floor);
        const wall = toon(new THREE.BoxGeometry(40, 12, 0.4), 0xf7ecd2, { outline: false });
        wall.position.set(0, 4.4, -4.2); s.add(wall);
        const shelf = toon(new THREE.BoxGeometry(9, 0.12, 0.8), 0xd9a066, { thickness: 0.04 });
        shelf.position.set(0, 2.9, -3.6); s.add(shelf);
        const cols = [0xf05d5e, 0x2ec4b6, 0xffbf47, 0x9b5de5, 0x4cc9f0, 0x80ed99, 0xf78c6b];
        for (let i = 0; i < 9; i++) {
            const hgt = rnd(0.5, 0.9);
            const b = toon(new THREE.CylinderGeometry(rnd(0.14, 0.22), rnd(0.16, 0.24), hgt, 12), cols[i % cols.length]);
            b.position.set(-3.8 + i * 0.95, 2.96 + hgt / 2, -3.6); s.add(b);
            const cap = toon(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 10), INK, { outline: false });
            cap.position.set(b.position.x, 2.96 + hgt + 0.06, -3.6); s.add(cap);
        }
        const bench = toon(new THREE.BoxGeometry(14, 0.5, 4.6), 0xbcd3e6, { thickness: 0.05 });
        bench.position.y = -0.25; s.add(bench);
        const benchBody = toon(new THREE.BoxGeometry(13.4, 1.1, 4.0), 0x5b7fd6, { thickness: 0.05 });
        benchBody.position.y = -1.05; s.add(benchBody);
        const benchPhys = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(7, 0.25, 2.3)) });
        benchPhys.position.set(0, -0.25, 0);
        this.world.addBody(benchPhys);
    }

    // ================= NESNELER =================
    buildProps() {
        this.balance = this.buildBalance();
        this.balance.position.set(-2.6, 0, 0.3);
        this.scene.add(this.balance);
        this.balanceBody.position.set(-2.6, 0, 0.3);
        this.world.addBody(this.balanceBody);

        // Tuz kavanozu (spatul buradan doldurulur)
        this.saltJar = this.model('salt_jar');
        this.saltJar.position.set(-0.9, 0, 1.2);
        this.saltJarLabel = label('NaCl', 'tag');
        this.saltJarLabel.position.set(0, 0.3, 0.36);
        this.saltJar.add(this.saltJarLabel);
        this.scene.add(this.saltJar);

        this.flask = this.buildFlask();
        this.setFlaskPosition(0.6, 0.3);
        this.scene.add(this.flask);
        this.world.addBody(this.flaskBody);
        // Boyun hedef halkasi (piset icin)
        this.neckRing = toon(new THREE.TorusGeometry(0.26, 0.025, 8, 24), 0x27ae60, { outline: false, transparent: true, opacity: 0.85 });
        this.neckRing.rotation.x = Math.PI / 2; this.neckRing.visible = false;
        this.scene.add(this.neckRing);
        this.neckRing.position.set(0.6, 2.25, 0.3);

        this.pipette = this.buildPipette();
        this.pipetteRest = new THREE.Vector3(1.6, 0.05, -0.4);
        this.pipette.position.copy(this.pipetteRest);
        this.scene.add(this.pipette);

        this.stockBottle = this.buildBottle(0xf7e07e, 'Stok');
        this.stockBottle.position.set(2.7, 0, -0.1);
        this.scene.add(this.stockBottle);

        this.washBottle = this.buildWashBottle();
        this.washRest = new THREE.Vector3(2.5, 0, -0.2);
        this.washBottle.position.copy(this.washRest);
        this.scene.add(this.washBottle);

        this.spatula = this.buildSpatula();
        this.spatulaRest = new THREE.Vector3(-1.6, 0.04, 1.9);
        this.spatula.position.copy(this.spatulaRest);
        this.scene.add(this.spatula);

        this.beaker = this.buildBeaker();
        this.beaker.position.set(0, 0, 0.3);
        this.scene.add(this.beaker);
        this.beakerBody.position.set(0, 0, 0.3);
        this.world.addBody(this.beakerBody);

        this.acidBottle = this.buildBottle(0xffd166, 'Derişik Asit');
        this.acidBottle.position.set(2.3, 0, 0.3);
        this.scene.add(this.acidBottle);
        this.waterBottle = this.buildBottle(0x7ec8f7, 'Saf Su');
        this.waterBottle.position.set(-2.3, 0, 0.3);
        this.scene.add(this.waterBottle);

        this.stirRod = toon(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), 0xe8f4ff, { thickness: 0.012 });
        this.stirRod.visible = false;
        this.scene.add(this.stirRod);
    }

    hitBox(size, y) {
        const hit = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
        hit.visible = false; hit.position.y = y; hit.name = 'hit';
        return hit;
    }

    buildBalance() {
        const g = this.model('balance');
        this.balanceLabel = label('0.00 g', 'reading');
        this.balanceLabel.position.set(0, 0.88, -0.47);
        g.add(this.balanceLabel);
        const boatY = 0.34, W = 1.0, H = 0.3;
        const boat = this.model('weigh_boat');
        boat.position.y = boatY; g.add(boat);
        const body = new CANNON.Body({ type: CANNON.Body.STATIC });
        body.addShape(new CANNON.Box(new CANNON.Vec3(W / 2, 0.02, W / 2)), new CANNON.Vec3(0, boatY + 0.02, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.02, H / 2, W / 2)), new CANNON.Vec3(W / 2 - 0.02, boatY + H / 2 + 0.02, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.02, H / 2, W / 2)), new CANNON.Vec3(-(W / 2 - 0.02), boatY + H / 2 + 0.02, 0));
        body.addShape(new CANNON.Box(new CANNON.Vec3(W / 2, H / 2, 0.02)), new CANNON.Vec3(0, boatY + H / 2 + 0.02, W / 2 - 0.02));
        body.addShape(new CANNON.Box(new CANNON.Vec3(W / 2, H / 2, 0.02)), new CANNON.Vec3(0, boatY + H / 2 + 0.02, -(W / 2 - 0.02)));
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.6, 0.02, 0.6)), new CANNON.Vec3(0, 0.32, 0));
        this.boatHalf = W / 2;
        this.balanceBody = body;
        this.boatTop = boatY + 0.04;
        return g;
    }

    buildFlaskVisual(withLiquid) {
        const g = this.model('flask');
        if (withLiquid) {
            const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.06);
            this.flaskPlane = plane;
            const liqBulb = toon(new THREE.SphereGeometry(0.56, 28, 18), 0x7ec8f7, { outline: false, clippingPlanes: [plane], shadow: false });
            liqBulb.position.y = 0.6; g.add(liqBulb);
            const liqNeck = toon(new THREE.CylinderGeometry(0.13, 0.13, 1.15, 16), 0x7ec8f7, { outline: false, clippingPlanes: [plane], shadow: false });
            liqNeck.position.y = 1.6; g.add(liqNeck);
            const surf = toon(new THREE.CircleGeometry(1, 28), 0xa9dcfb, { outline: false, shadow: false });
            surf.rotation.x = -Math.PI / 2; g.add(surf);
            this.flaskLiquid = { bulb: liqBulb, neck: liqNeck, surf };
            this.flaskMarkLabel = label('Ölçü çizgisi', 'tag');
            this.flaskMarkLabel.position.set(0.55, 1.85, 0);
            g.add(this.flaskMarkLabel);
        }
        return g;
    }

    buildFlask() {
        const g = this.buildFlaskVisual(true);
        const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC });
        addFloor(body, 0.34, 0.04);
        addRing(body, 12, 0.5, 0.3, 0.32, 0.16, -0.55);
        addRing(body, 12, 0.5, 0.9, 0.32, 0.16, 0.55);
        addRing(body, 8, 0.17, 1.66, 0.55, 0.08, 0);
        this.flaskBody = body;
        this.updateFlaskLiquid();
        return g;
    }

    setFlaskPosition(x, z) {
        this.flask.position.set(x, 0, z);
        this.flaskBody.position.set(x, 0, z);
        this.flaskTarget = { x, z, r: 0.52, topY: 1.15 };
        if (this.neckRing) this.neckRing.position.set(x, 2.25, z);
    }

    configureTask({ targetVolume, stockColor, dissolvedColor, grainColor }) {
        this.flaskMaxVol = targetVolume;
        this.flaskStockVol = 0;
        this.flaskWaterVol = 0;
        this.stockColor = stockColor ?? 0xf7e07e;
        this.dissolvedColor = dissolvedColor ?? 0xa8dcf7;
        this.grainColor = grainColor ?? 0xfafafa;
        this.waterPerDrop = targetVolume / 120;
        this.stockBottle.userData.liquid.material.color.set(this.stockColor);
        this.pipette.userData.liquid.material.color.set(this.stockColor);
        this.setPipetteFraction(0);
        this.setPipetteLabel('0.00 mL');
        this.setFlaskColor(0x7ec8f7);
        this.setSpatulaLoaded(false);
        this.clearDynamic();
        this.updateFlaskLiquid();
    }
    setStockLabel(text) { this.stockBottle.userData.label.element.textContent = text; }
    setFlaskColor(hex) {
        const c = new THREE.Color(hex);
        this.flaskLiquid.bulb.material.color.copy(c);
        this.flaskLiquid.neck.material.color.copy(c);
        this.flaskLiquid.surf.material.color.copy(c).lerp(new THREE.Color(0xffffff), 0.3);
    }
    get flaskVolume() { return this.flaskStockVol + this.flaskWaterVol; }
    updateFlaskLiquid() {
        const vol = this.flaskVolume;
        const f = Math.min(1.12, vol / this.flaskMaxVol);
        const y = vol <= 0 ? -1 : 0.06 + f * (1.85 - 0.06);
        this.flaskLevelY = y;
        this.flaskPlane.constant = y;
        const surf = this.flaskLiquid.surf;
        if (vol <= 0) { surf.visible = false; return; }
        surf.visible = true;
        let r;
        if (y < 1.12) { const d = y - 0.6; r = Math.sqrt(Math.max(0.001, 0.56 * 0.56 - d * d)); }
        else r = 0.13;
        surf.scale.set(r, r, 1);
        surf.position.y = y;
    }

    buildPipette() {
        const g = this.model('pipette');
        const liqGeo = new THREE.CylinderGeometry(0.03, 0.012, 1.3, 10);
        liqGeo.translate(0, 0.65, 0);
        const liq = toon(liqGeo, 0xf7e07e, { outline: false, shadow: false });
        liq.position.y = 0.06; liq.scale.y = 0.001; g.add(liq);
        g.userData.liquid = liq;
        const lbl = label('0.00 mL', 'reading small');
        lbl.position.set(0.35, 0.9, 0); g.add(lbl);
        g.userData.label = lbl;
        return g;
    }
    setPipetteFraction(f) { this.pipette.userData.liquid.scale.y = Math.max(0.001, f); }

    buildBottle(liquidColor, text) {
        const g = this.model('reagent_bottle');
        const liq = toon(new THREE.CylinderGeometry(0.28, 0.28, 0.72, 18), liquidColor, { outline: false, shadow: false });
        liq.position.y = 0.38; g.add(liq);
        const lbl = label(text, 'tag');
        lbl.position.set(0, 0.45, 0.34); g.add(lbl);
        g.userData.liquid = liq;
        g.userData.label = lbl;
        return g;
    }

    buildWashBottle() {
        const g = this.model('wash_bottle');
        const liq = toon(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16), 0x7ec8f7, { outline: false, shadow: false });
        liq.position.y = 0.33; g.add(liq);
        const lbl = label('Piset (Saf Su)', 'tag');
        lbl.position.set(0, 0.4, 0.26); g.add(lbl);
        // Blender'da uc (+0.42, z 1.15) -> three'de (-0.42, 1.15, 0)
        const tip = new THREE.Object3D(); tip.position.set(-0.42, 1.15, 0); g.add(tip);
        g.userData.tip = tip;
        g.add(this.hitBox([0.7, 1.4, 0.7], 0.65));
        return g;
    }

    buildSpatula() {
        const g = this.model('spatula');
        const tip = new THREE.Object3D(); tip.position.set(0, 0.05, -0.44); g.add(tip);
        g.userData.tip = tip;
        // Kasiktaki tuz (yuklenince gorunur)
        const load = new THREE.Group();
        for (let i = 0; i < 26; i++) {
            const s = toon(new THREE.BoxGeometry(0.035, 0.035, 0.035), 0xfafafa, { thickness: 0.005 });
            s.position.set(rnd(-0.06, 0.06), 0.04 + rnd(0, 0.05), -0.44 + rnd(-0.08, 0.08));
            s.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
            load.add(s);
        }
        load.visible = false; g.add(load);
        g.userData.load = load;
        g.add(this.hitBox([0.5, 0.3, 1.0], 0.05));
        return g;
    }
    setSpatulaLoaded(v) { this.spatulaLoaded = v; this.spatula.userData.load.visible = v; }

    buildBeakerVisual(withLiquid) {
        const g = this.model('beaker');
        if (withLiquid) {
            const liqGeo = new THREE.CylinderGeometry(0.41, 0.41, 1, 20);
            liqGeo.translate(0, 0.5, 0);
            const liq = toon(liqGeo, 0x7ec8f7, { outline: false, shadow: false });
            liq.position.y = 0.04; g.add(liq);
            g.userData.liquid = liq;
            const lbl = label('Beher', 'tag');
            lbl.position.set(0, 1.1, 0); g.add(lbl);
            g.userData.label = lbl;
        }
        return g;
    }
    buildBeaker() {
        const g = this.buildBeakerVisual(true);
        const body = new CANNON.Body({ type: CANNON.Body.STATIC });
        addFloor(body, 0.45, 0.04);
        addRing(body, 12, 0.45, 0.45, 0.45, 0.13, 0);
        this.beakerBody = body;
        this.beaker = g;
        this.setBeakerVolume(60);
        return g;
    }
    setBeakerVolume(v) {
        this.beakerVol = v;
        const h = Math.min(0.82, v / 100 * 0.82);
        this.beaker.userData.liquid.scale.y = Math.max(0.001, h);
        this.beakerLevelY = 0.04 + h;
        this.beakerTarget = { x: this.beaker.position.x, z: this.beaker.position.z, r: 0.42, topY: 0.95 };
    }
    setBeakerColor(hex) { this.beaker.userData.liquid.material.color.set(hex); }
    setBeakerLabel(t) { this.beaker.userData.label.element.textContent = t; }

    // ================= KKD (guvenlik adiminda tezgahta durur, giyilince kalkar) =================
    buildPPE() {
        const g = new THREE.Group();
        const items = { coat: this.model('lab_coat'), goggles: this.model('goggles'), gloves: this.model('gloves') };
        items.coat.position.set(-1.7, 0, -1.4); items.coat.scale.setScalar(1.1);
        items.goggles.position.set(0, 0, -1.4);
        items.gloves.position.set(1.7, 0, -1.4);
        const names = { coat: 'Önlük', goggles: 'Gözlük', gloves: 'Eldiven' };
        Object.entries(items).forEach(([k, it]) => {
            const lbl = label(names[k], 'tag'); lbl.position.set(0, 1.25, 0); it.add(lbl); g.add(it);
        });
        this.ppeItems = items;
        this.ppeGroup = g;
        this.scene.add(g);
    }
    equipPPE(item) {
        const it = this.ppeItems[item];
        if (!it || !it.visible) return;
        const y0 = it.position.y;
        this.tween(0.4, (k) => { it.position.y = y0 + k * 1.2; it.scale.setScalar((1 - k) * (item === 'coat' ? 1.1 : 1)); }, () => {
            it.visible = false; it.position.y = y0; it.scale.setScalar(item === 'coat' ? 1.1 : 1); this.syncLabels();
        });
    }
    resetPPE() {
        Object.values(this.ppeItems).forEach((it) => { it.visible = true; });
        this.syncLabels();
    }

    // ================= EKIPMAN RAFI =================
    buildEquipmentShelf() {
        const g = new THREE.Group();
        [[2.15, -1.4], [0.75, -0.5]].forEach(([y, z]) => {
            const plank = toon(new THREE.BoxGeometry(9.2, 0.1, 1.0), 0xd9a066, { thickness: 0.04 });
            plank.position.set(0, y, z); g.add(plank);
        });
        [-4.4, 4.4].forEach((x) => {
            const leg = toon(new THREE.BoxGeometry(0.12, 2.15, 0.9), 0xc48a4f, { thickness: 0.03 });
            leg.position.set(x, 1.075, -1.4); g.add(leg);
            const leg2 = toon(new THREE.BoxGeometry(0.12, 0.75, 0.9), 0xc48a4f, { thickness: 0.03 });
            leg2.position.set(x, 0.375, -0.5); g.add(leg2);
        });
        this.equipmentItems = {};
        const ids = ['BALANCE', 'SPATULA', 'BEAKER', 'VOLUMETRIC_FLASK', 'GRADUATED_CYLINDER', 'PIPETTE',
            'DISTILLED_WATER', 'REAGENT_BOTTLE', 'WASTE_CONTAINER', 'SAFETY_GOGGLES', 'GLOVES', 'LAB_COAT'];
        const names = {
            BALANCE: 'Terazi', SPATULA: 'Spatul', BEAKER: 'Beher', VOLUMETRIC_FLASK: 'Balon Joje',
            GRADUATED_CYLINDER: 'Mezür', PIPETTE: 'Pipet', DISTILLED_WATER: 'Saf Su', REAGENT_BOTTLE: 'Reaktif Şişesi',
            WASTE_CONTAINER: 'Atık Kabı', SAFETY_GOGGLES: 'Koruyucu Gözlük', GLOVES: 'Eldiven', LAB_COAT: 'Laboratuvar Önlüğü'
        };
        ids.forEach((id, i) => {
            const item = this.buildEquipmentItem(id);
            const row = i < 6 ? 1 : 0;
            const col = i % 6;
            const x = -3.75 + col * 1.5;
            const y = row === 1 ? 2.2 : 0.8;
            const z = row === 1 ? -1.4 : -0.5;
            item.position.set(x, y, z);
            item.userData.eqId = id;
            item.userData.baseY = y;
            item.add(this.hitBox([1.2, 1.1, 0.9], 0.5));
            const lbl = label(names[id], 'eq');
            lbl.position.set(0, -0.12, 0.35);
            item.add(lbl);
            item.userData.label = lbl;
            g.add(item);
            this.equipmentItems[id] = item;
            this.pickables.push(item);
        });
        this.equipmentShelf = g;
        this.scene.add(g);
    }

    buildEquipmentItem(id) {
        const g = new THREE.Group();
        const s = (obj, k) => { obj.scale.setScalar(k); g.add(obj); return obj; };
        const liqCyl = (r, h, y, parent, color = 0x7ec8f7) => { const l = toon(new THREE.CylinderGeometry(r, r, h, 18), color, { outline: false }); l.position.y = y; parent.add(l); };
        switch (id) {
            case 'BALANCE': { const b = this.model('balance'); const boat = this.model('weigh_boat'); boat.position.y = 0.34; b.add(boat); s(b, 0.6); break; }
            case 'SPATULA': { const sp = this.model('spatula'); sp.rotation.set(0, 0.5, 0); sp.position.y = 0.05; s(sp, 1); break; }
            case 'BEAKER': { const b = this.model('beaker'); liqCyl(0.41, 0.4, 0.24, b); s(b, 0.75); break; }
            case 'VOLUMETRIC_FLASK': { const f = this.model('flask'); const liq = toon(new THREE.SphereGeometry(0.45, 16, 12), 0x7ec8f7, { outline: false }); liq.position.y = 0.5; f.add(liq); s(f, 0.42); break; }
            case 'GRADUATED_CYLINDER': { const c = this.model('graduated_cylinder'); liqCyl(0.1, 0.6, 0.36, c); s(c, 0.85); break; }
            case 'PIPETTE': { const p = this.model('pipette'); p.rotation.z = 0.35; p.position.set(-0.25, 0.05, 0); s(p, 0.6); break; }
            case 'DISTILLED_WATER': { const w = this.model('wash_bottle'); liqCyl(0.2, 0.6, 0.33, w); s(w, 0.9); break; }
            case 'REAGENT_BOTTLE': { const b = this.model('reagent_bottle'); liqCyl(0.28, 0.72, 0.38, b, 0xd9a441); s(b, 0.75); break; }
            case 'WASTE_CONTAINER': { s(this.model('waste_bin'), 0.85); break; }
            case 'SAFETY_GOGGLES': { s(this.model('goggles'), 0.9); break; }
            case 'GLOVES': { s(this.model('gloves'), 0.9); break; }
            case 'LAB_COAT': { s(this.model('lab_coat'), 0.85); break; }
        }
        return g;
    }

    // ================= ISARETCI: SECME + SURUKLEME =================
    setupPointer() {
        this.raycaster = new THREE.Raycaster();
        const el = this.renderer.domElement;
        const ndc = (e) => {
            const rect = el.getBoundingClientRect();
            return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        };
        let down = null;
        this.drag = null;
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hitPoint = new THREE.Vector3();
        const currentDraggables = () => this.draggables.filter((d) => d.mode === this.mode && d.obj.visible && !d.busy());

        el.addEventListener('pointerdown', (e) => {
            down = { x: e.clientX, y: e.clientY };
            const ds = currentDraggables();
            if (!ds.length) return;
            this.raycaster.setFromCamera(ndc(e), this.camera);
            const hits = this.raycaster.intersectObjects(ds.map((d) => d.obj), true);
            if (!hits.length) return;
            let o = hits[0].object;
            while (o && !ds.find((d) => d.obj === o)) o = o.parent;
            const d = ds.find((dd) => dd.obj === o);
            if (!d) return;
            this.drag = d;
            this.controls.enabled = false;
            try { el.setPointerCapture(e.pointerId); } catch (_) { /* yok */ }
            dragPlane.constant = -d.height;
            d.onStart && d.onStart(d.obj);
            // Ilk konum
            if (this.raycaster.ray.intersectPlane(dragPlane, hitPoint)) d.obj.position.set(hitPoint.x, d.height, hitPoint.z);
        });
        el.addEventListener('pointermove', (e) => {
            if (this.drag) {
                this.raycaster.setFromCamera(ndc(e), this.camera);
                if (this.raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
                    const x = THREE.MathUtils.clamp(hitPoint.x, -6, 6), z = THREE.MathUtils.clamp(hitPoint.z, -2.1, 2.2);
                    this.drag.obj.position.set(x, this.drag.height, z);
                    this.drag.onMove && this.drag.onMove(this.drag.obj);
                }
                return;
            }
            const ds = currentDraggables();
            if (this.mode !== 'equipment' && !ds.length) { el.style.cursor = ''; return; }
            this.raycaster.setFromCamera(ndc(e), this.camera);
            const targets = this.mode === 'equipment' ? this.pickables : ds.map((d) => d.obj);
            el.style.cursor = this.raycaster.intersectObjects(targets, true).length ? (this.mode === 'equipment' ? 'pointer' : 'grab') : '';
        });
        const endDrag = (e) => {
            if (!this.drag) return false;
            const d = this.drag;
            this.drag = null;
            this.controls.enabled = true;
            try { el.releasePointerCapture(e.pointerId); } catch (_) { /* yok */ }
            d.onEnd && d.onEnd(d.obj);
            return true;
        };
        el.addEventListener('pointerup', (e) => {
            if (endDrag(e)) { down = null; return; }
            if (!down) return;
            const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
            down = null;
            if (moved > 6 || this.mode !== 'equipment' || !this.onPick) return;
            this.raycaster.setFromCamera(ndc(e), this.camera);
            const hits = this.raycaster.intersectObjects(this.pickables, true);
            if (!hits.length) return;
            let o = hits[0].object;
            while (o && !o.userData.eqId) o = o.parent;
            if (o) this.onPick(o.userData.eqId);
        });
        el.addEventListener('pointercancel', endDrag);

        this.setupDraggables();
    }

    setupDraggables() {
        const tipPos = (obj) => obj.userData.tip.getWorldPosition(new THREE.Vector3());
        // --- SPATUL: kavanozdan doldur, tartim kabina birak ---
        this.draggables.push({
            obj: this.spatula, mode: 'weigh', height: 0.78, busy: () => !!this.spatulaBusy,
            onStart: (sp) => { sp.rotation.set(0, 0, 0); },
            onMove: (sp) => {
                const t = tipPos(sp), j = this.saltJar.position;
                if (!this.spatulaLoaded && Math.hypot(t.x - j.x, t.z - j.z) < 0.5) {
                    this.setSpatulaLoaded(true);
                    this.saltJarLabel.element.classList.add('selected');
                    setTimeout(() => this.saltJarLabel.element.classList.remove('selected'), 400);
                }
                const b = this.balance.position;
                const over = Math.abs(t.x - b.x) < this.boatHalf && Math.abs(t.z - b.z) < this.boatHalf;
                this.balanceLabel.element.classList.toggle('selected', over && this.spatulaLoaded);
            },
            onEnd: (sp) => {
                this.balanceLabel.element.classList.remove('selected');
                const t = tipPos(sp), b = this.balance.position;
                const over = Math.abs(t.x - b.x) < this.boatHalf && Math.abs(t.z - b.z) < this.boatHalf;
                if (this.spatulaLoaded && over) this.pourSpatula();
                else { this.setSpatulaLoaded(false); this.moveTo(sp, this.spatulaRest, 0.4, new THREE.Vector3(0, 0, 0)); }
            }
        });
        // --- PISET: jojenin boynuna getir, tuttugun surece akar ---
        this.draggables.push({
            obj: this.washBottle, mode: 'water', height: 1.85, busy: () => false,
            onStart: (wb) => { wb.rotation.set(0, 0, 0.95); this.neckRing.visible = true; },
            onMove: (wb) => {
                const t = tipPos(wb), f = this.flaskTarget;
                const inRange = Math.hypot(t.x - f.x, t.z - f.z) < 0.28 && t.y > 1.9;
                this.squeezing = inRange;
                this.neckRing.material.color.set(inRange ? 0x27ae60 : 0xe67e22);
                this.neckRing.scale.setScalar(inRange ? 1.15 : 1);
            },
            onEnd: (wb) => {
                this.squeezing = false;
                this.neckRing.visible = false;
                this.moveTo(wb, this.washRest, 0.45, new THREE.Vector3(0, 0, 0));
            }
        });
    }

    async pourSpatula() {
        const sp = this.spatula;
        this.spatulaBusy = true;
        const r0 = sp.rotation.clone();
        await this.tweenP(0.25, (k) => { sp.rotation.x = r0.x - 1.3 * k; });
        this.setSpatulaLoaded(false);
        const n = 26 + Math.floor(Math.random() * 12);
        for (let i = 0; i < n; i++) {
            const t = sp.userData.tip.getWorldPosition(new THREE.Vector3());
            const g = this.spawnGrain(t.x + rnd(-0.04, 0.04), t.y - 0.02, t.z + rnd(-0.04, 0.04), rnd(0.035, 0.06), this.grainColor);
            if (g) this.grains.push(g);
            await sleep(18);
        }
        await sleep(250);
        await this.moveTo(sp, this.spatulaRest, 0.4, new THREE.Vector3(0, 0, 0));
        this.spatulaBusy = false;
        if (this.onPour) this.onPour('grain', n);
    }

    setSelected(id, on) {
        const item = this.equipmentItems[id];
        if (!item) return;
        if (on) this.selected.add(id); else this.selected.delete(id);
        item.userData.label.element.classList.toggle('selected', on);
        const from = item.position.y, to = item.userData.baseY + (on ? 0.3 : 0);
        this.tween(0.25, (k) => { item.position.y = from + (to - from) * k; });
        item.traverse((m) => {
            if (m.isMesh && m.material && m.material.isMeshToonMaterial) {
                if (m.material.userData.origEmissive === undefined) m.material.userData.origEmissive = m.material.emissive.getHex();
                m.material.emissive.setHex(on ? 0x2244aa : m.material.userData.origEmissive);
            }
        });
    }
    clearSelection() { [...this.selected].forEach((id) => this.setSelected(id, false)); }

    // ================= DUZEN / MOD =================
    layout(mode, opts = {}) {
        this.mode = mode;
        const isLiq = !!opts.liquid;
        const show = (obj, v) => { obj.visible = v; };
        const labMode = ['weigh', 'pipette', 'transfer', 'water', 'done'].includes(mode);
        show(this.balance, mode === 'idle' || (labMode && !isLiq));
        show(this.saltJar, mode === 'idle' || (labMode && !isLiq));
        show(this.flask, mode === 'idle' || labMode);
        show(this.pipette, mode === 'idle' || (labMode && isLiq));
        show(this.stockBottle, mode === 'idle' || (labMode && isLiq));
        show(this.washBottle, mode === 'idle' || labMode);
        show(this.spatula, mode === 'idle' || (labMode && !isLiq));
        show(this.beaker, mode === 'acid' || mode === 'safety' || mode === 'idle');
        show(this.acidBottle, mode === 'acid');
        show(this.waterBottle, mode === 'acid');
        show(this.ppeGroup, mode === 'safety');
        show(this.equipmentShelf, mode === 'equipment');
        this.stirRod.visible = false;
        this.neckRing.visible = false;
        this.squeezing = false;
        this.beaker.position.set(mode === 'idle' ? 1.8 : 0, 0, mode === 'idle' ? -0.6 : 0.3);
        this.beakerBody.position.copy(this.beaker.position);
        this.setBeakerVolume(this.beakerVol);
        this.controls.autoRotate = mode === 'done';
        this.goView(mode);
        this.syncLabels();
    }
    syncLabels() {
        const walk = (o, vis) => {
            const v = vis && (o.isCSS2DObject || o.visible);
            if (o.isCSS2DObject) { o.visible = v; o.element.style.display = v ? '' : 'none'; return; }
            o.children.forEach((c) => walk(c, v));
        };
        walk(this.scene, true);
    }
    goView(name, dur = 1.1) {
        const v = VIEWS[name] || VIEWS.idle;
        const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
        const p1 = new THREE.Vector3(...v.pos), t1 = new THREE.Vector3(...v.target);
        return this.tweenP(dur, (k) => {
            this.camera.position.lerpVectors(p0, p1, k);
            this.controls.target.lerpVectors(t0, t1, k);
        });
    }

    // ================= TWEEN =================
    tween(dur, fn, onDone) { this.tweens.push({ t: 0, dur, fn, onDone }); }
    tweenP(dur, fn) { return new Promise((res) => this.tween(dur, fn, res)); }
    moveTo(obj, target, dur, rot) {
        const p0 = obj.position.clone(), p1 = new THREE.Vector3().copy(target);
        const r0 = obj.rotation.clone();
        return this.tweenP(dur, (k) => {
            obj.position.lerpVectors(p0, p1, k);
            if (rot) { obj.rotation.x = r0.x + (rot.x - r0.x) * k; obj.rotation.y = r0.y + (rot.y - r0.y) * k; obj.rotation.z = r0.z + (rot.z - r0.z) * k; }
        });
    }

    // ================= DINAMIK NESNELER =================
    template(key, build) {
        if (!this.templates[key]) this.templates[key] = build();
        return this.templates[key].clone();
    }
    addDynamic(mesh, body, extra) {
        this.scene.add(mesh);
        this.world.addBody(body);
        const d = Object.assign({ mesh, body }, extra);
        this.dynamics.push(d);
        return d;
    }
    removeDynamic(d) {
        this.world.removeBody(d.body);
        if (d.mesh) this.scene.remove(d.mesh);
        else { const gp = this.grainPool; const gi = gp.list.indexOf(d); if (gi >= 0) gp.list.splice(gi, 1); }
        const i = this.dynamics.indexOf(d); if (i >= 0) this.dynamics.splice(i, 1);
        const g = this.grains.indexOf(d); if (g >= 0) this.grains.splice(g, 1);
        const f = this.flaskGrains.indexOf(d); if (f >= 0) this.flaskGrains.splice(f, 1);
        const dr = this.droplets.indexOf(d); if (dr >= 0) this.droplets.splice(dr, 1);
    }
    clearDynamic() { [...this.dynamics].forEach((d) => this.removeDynamic(d)); }

    // Tuz kristalleri: tek InstancedMesh (kristal + dis cizgi) ile cizilir
    buildGrainPool() {
        const MAX = 1200;
        const geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const mesh = new THREE.InstancedMesh(geo, toonMaterial(0xfafafa), MAX);
        mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0;
        const og = mergeVertices(geo, 1e-4); og.computeVertexNormals();
        const outline = new THREE.InstancedMesh(og, outlineMaterial(0.006), MAX);
        outline.frustumCulled = false; outline.count = 0; outline.raycast = () => {};
        this.scene.add(mesh); this.scene.add(outline);
        this.grainPool = { mesh, outline, list: [], max: MAX, m4: new THREE.Matrix4(), sc: new THREE.Vector3(), q: new THREE.Quaternion(), p: new THREE.Vector3() };
    }
    setGrainColor(hex) { this.grainPool.mesh.material.color.set(hex); }
    updateGrainPool() {
        const gp = this.grainPool;
        for (let i = 0; i < gp.list.length; i++) {
            const d = gp.list[i];
            gp.sc.setScalar(d.scale);
            const bp = d.body.position, bq = d.body.quaternion;
            gp.p.set(bp.x, bp.y, bp.z); gp.q.set(bq.x, bq.y, bq.z, bq.w);
            gp.m4.compose(gp.p, gp.q, gp.sc);
            gp.mesh.setMatrixAt(i, gp.m4);
            gp.outline.setMatrixAt(i, gp.m4);
        }
        gp.mesh.count = gp.list.length; gp.outline.count = gp.list.length;
        gp.mesh.instanceMatrix.needsUpdate = true; gp.outline.instanceMatrix.needsUpdate = true;
    }
    spawnGrain(x, y, z, chemMass, color = 0xfafafa) {
        const gp = this.grainPool;
        if (gp.list.length >= gp.max) return null;
        this.setGrainColor(color);
        const body = new CANNON.Body({
            mass: 0.005, shape: this.grainShape, position: new CANNON.Vec3(x, y, z),
            linearDamping: 0.35, angularDamping: 0.9, allowSleep: true, sleepSpeedLimit: 0.3, sleepTimeLimit: 0.3
        });
        body.quaternion.setFromEuler(rnd(0, 3), rnd(0, 3), rnd(0, 3));
        body.velocity.set(rnd(-0.15, 0.15), -0.3, rnd(-0.15, 0.15));
        this.world.addBody(body);
        const d = { kind: 'grain', body, chemMass, scale: 1, mesh: null };
        this.dynamics.push(d);
        gp.list.push(d);
        return d;
    }
    // Taneyi fizik ve cizimden cikar (grains/flaskGrains listelerine dokunmaz)
    detachGrain(g) {
        this.world.removeBody(g.body);
        const gp = this.grainPool;
        const i = gp.list.indexOf(g); if (i >= 0) gp.list.splice(i, 1);
        const k = this.dynamics.indexOf(g); if (k >= 0) this.dynamics.splice(k, 1);
    }
    spawnDroplet(x, y, z, color, opts = {}) {
        const mesh = this.template('drop' + color, () => toon(new THREE.SphereGeometry(0.04, 8, 6), color, { thickness: 0.01 }));
        const body = new CANNON.Body({ mass: 0.005, shape: this.dropShape, position: new CANNON.Vec3(x, y, z), linearDamping: 0.02 });
        if (opts.velocity) body.velocity.set(...opts.velocity);
        const d = this.addDynamic(mesh, body, { kind: 'drop', life: 0, minLife: opts.minLife ?? 0, maxLife: opts.maxLife ?? 4, target: opts.target, onLand: opts.onLand });
        this.droplets.push(d);
        return d;
    }
    async emitDroplets(origin, count, color, opts = {}) {
        const batch = [];
        for (let i = 0; i < count; i++) {
            const d = this.spawnDroplet(origin.x + rnd(-0.03, 0.03), origin.y, origin.z + rnd(-0.03, 0.03), color, opts);
            batch.push(d);
            await sleep(opts.interval ?? 45);
        }
        const t0 = performance.now();
        while (batch.some((d) => this.dynamics.includes(d)) && performance.now() - t0 < 2500) await sleep(50);
    }

    // ================= TARTIM =================
    getPanMass() {
        const bx = this.balance.position.x, bz = this.balance.position.z;
        let m = 0;
        for (const g of this.grains) {
            const p = g.body.position;
            if (Math.abs(p.x - bx) < this.boatHalf && Math.abs(p.z - bz) < this.boatHalf && p.y > this.boatTop - 0.05 && p.y < this.boatTop + 0.7) m += g.chemMass;
        }
        return m;
    }
    removeSome(mass = 0.5) {
        let removed = 0;
        while (this.grains.length && removed < mass) {
            const g = this.grains[this.grains.length - 1];
            removed += g.chemMass;
            this.grains.pop();
            this.world.removeBody(g.body);
            const i = this.dynamics.indexOf(g); if (i >= 0) this.dynamics.splice(i, 1);
            this.tween(0.25, (k) => { g.scale = 1 - k; }, () => { const gi = this.grainPool.list.indexOf(g); if (gi >= 0) this.grainPool.list.splice(gi, 1); });
        }
        return removed;
    }

    // ================= PIPET =================
    async pipetteDraw(fraction) {
        const sb = this.stockBottle.position;
        const p = this.pipette;
        await this.moveTo(p, new THREE.Vector3(sb.x, 0.6, sb.z), 0.5);
        const f0 = p.userData.liquid.scale.y;
        await this.tweenP(0.5, (k) => this.setPipetteFraction(f0 + (fraction - f0) * k));
        await this.moveTo(p, new THREE.Vector3(sb.x, 1.3, sb.z), 0.3);
    }
    async pipetteRelease(volume) {
        const p = this.pipette, ft = this.flaskTarget;
        await this.moveTo(p, new THREE.Vector3(ft.x, 2.35, ft.z), 0.6);
        const n = Math.max(8, Math.min(40, Math.round(volume * 1.2)));
        const per = volume / n;
        const f0 = p.userData.liquid.scale.y;
        this.tween(n * 0.05, (k) => this.setPipetteFraction(f0 * (1 - k)));
        await this.emitDroplets(new THREE.Vector3(ft.x, 2.3, ft.z), n, this.stockColor, {
            target: 'flask', interval: 50,
            onLand: () => { this.flaskStockVol += per; this.updateFlaskLiquid(); }
        });
        this.setPipetteFraction(0);
        await this.moveTo(p, this.pipetteRest, 0.5);
    }
    setPipetteLabel(t) { this.pipette.userData.label.element.textContent = t; }

    // ================= AKTARMA =================
    async transferSolid(grainColor) {
        const sp = this.spatula, ft = this.flaskTarget;
        const bx = this.balance.position.x, bz = this.balance.position.z;
        [...this.grains].forEach((g) => {
            const p = g.body.position;
            if (!(Math.abs(p.x - bx) < this.boatHalf && Math.abs(p.z - bz) < this.boatHalf && p.y > this.boatTop - 0.05)) this.removeDynamic(g);
        });
        this.spatulaBusy = true;
        while (this.grains.length) {
            const batch = this.grains.splice(-60);
            await this.moveTo(sp, new THREE.Vector3(bx + 0.05, this.boatTop + 0.25, bz + 0.45), 0.4, new THREE.Vector3(-0.4, 0, 0));
            batch.forEach((g) => this.detachGrain(g));
            this.setSpatulaLoaded(true);
            await this.moveTo(sp, new THREE.Vector3(ft.x, 2.45, ft.z + 0.45), 0.7, new THREE.Vector3(-0.4, 0, 0));
            await this.moveTo(sp, new THREE.Vector3(ft.x, 2.45, ft.z + 0.45), 0.25, new THREE.Vector3(-1.5, 0, 0));
            this.setSpatulaLoaded(false);
            for (const g of batch) {
                const d = this.spawnGrain(ft.x + rnd(-0.04, 0.04), 2.3, ft.z + rnd(-0.04, 0.04), g.chemMass, grainColor);
                if (!d) continue;
                d.body.velocity.set(0, -0.8, 0);
                this.flaskGrains.push(d);
                await sleep(16);
            }
            await sleep(500);
        }
        await this.moveTo(sp, this.spatulaRest, 0.5, new THREE.Vector3(0, 0, 0));
        this.spatulaBusy = false;
    }
    async transferLiquid() {
        const p = this.pipette, ft = this.flaskTarget;
        await this.moveTo(p, new THREE.Vector3(ft.x, 2.35, ft.z), 0.6);
        await this.emitDroplets(new THREE.Vector3(ft.x, 2.3, ft.z), 8, 0x7ec8f7, { target: 'flask', interval: 60, onLand: () => { this.flaskStockVol += 0.05; this.updateFlaskLiquid(); } });
        await this.moveTo(p, this.pipetteRest, 0.5);
    }

    // ================= COZME / KARISTIRMA =================
    async dissolve() {
        const grains = [...this.flaskGrains];
        const c0 = this.flaskLiquid.bulb.material.color.clone(), c1 = new THREE.Color(this.dissolvedColor);
        grains.forEach((g, i) => {
            setTimeout(() => {
                this.world.removeBody(g.body);
                this.tween(0.8, (k) => { g.scale = 1 - k; }, () => this.removeDynamic(g));
            }, i * 6);
        });
        await this.tweenP(1.2, (k) => this.setFlaskColor(c0.clone().lerp(c1, k).getHex()));
        await sleep(grains.length * 6 + 300);
    }
    async mix() {
        const base = this.flask.position.clone();
        await this.tweenP(1.4, (k, raw) => {
            const a = raw * Math.PI * 6, r = 0.12 * Math.sin(raw * Math.PI);
            const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
            this.flask.position.set(x, 0, z);
            this.flaskBody.position.set(x, 0, z);
            this.flaskLiquid.surf.rotation.set(-Math.PI / 2 + Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12);
        });
        this.flask.position.copy(base); this.flaskBody.position.set(base.x, 0, base.z);
        this.flaskLiquid.surf.rotation.set(-Math.PI / 2, 0, 0);
    }

    // ================= GUVENLIK / ASIT =================
    setupAcid() {
        this.clearDynamic();
        this.setBeakerVolume(55);
        this.setBeakerColor(0x7ec8f7);
        this.setBeakerLabel('Beher');
        this.acidBottle.position.set(2.3, 0, 0.3); this.acidBottle.rotation.set(0, 0, 0);
        this.waterBottle.position.set(-2.3, 0, 0.3); this.waterBottle.rotation.set(0, 0, 0);
        this.syncLabels();
    }
    async pourWrong() {
        const bt = this.beakerTarget, b = this.waterBottle;
        this.setBeakerColor(0xffd166); this.setBeakerLabel('Derişik Asit');
        await this.moveTo(b, new THREE.Vector3(bt.x - 0.75, 1.5, bt.z), 0.6, new THREE.Vector3(0, 0, -1.9));
        let landed = 0;
        const boom = () => {
            landed++;
            if (landed !== 4) return;
            for (let i = 0; i < 70; i++) {
                const col = [0xff6b35, 0xffd166, 0xf05d5e][i % 3];
                this.spawnDroplet(bt.x + rnd(-0.2, 0.2), this.beakerLevelY + 0.1, bt.z + rnd(-0.2, 0.2), col,
                    { velocity: [rnd(-2.5, 2.5), rnd(3.5, 8), rnd(-2.5, 2.5)], minLife: 0.7, maxLife: 3.5, target: 'beaker' });
            }
            for (let i = 0; i < 10; i++) this.steam(bt.x + rnd(-0.3, 0.3), this.beakerLevelY + 0.2, bt.z + rnd(-0.3, 0.3));
            const base = this.beaker.position.clone();
            this.tween(0.6, (k, raw) => { this.beaker.position.x = base.x + Math.sin(raw * 40) * 0.06 * (1 - k); }, () => this.beaker.position.copy(base));
        };
        await this.emitDroplets(new THREE.Vector3(bt.x - 0.05, 1.7, bt.z), 10, 0x7ec8f7, { target: 'beaker', interval: 70, onLand: boom });
        await sleep(600);
        await this.moveTo(b, new THREE.Vector3(-2.3, 0, 0.3), 0.6, new THREE.Vector3(0, 0, 0));
    }
    async pourCorrect() {
        const bt = this.beakerTarget, b = this.acidBottle;
        this.setBeakerColor(0x7ec8f7); this.setBeakerLabel('Saf Su');
        this.stirRod.visible = true;
        this.stirRod.position.set(bt.x + 0.15, 0.7, bt.z); this.stirRod.rotation.z = -0.25;
        await this.moveTo(b, new THREE.Vector3(bt.x + 0.75, 1.5, bt.z), 0.6, new THREE.Vector3(0, 0, 1.9));
        const c0 = new THREE.Color(0x7ec8f7), c1 = new THREE.Color(0xa6e0c9);
        let n = 0;
        const stir = this.tweenP(2.2, (k, raw) => {
            const a = raw * Math.PI * 8;
            this.stirRod.position.set(bt.x + Math.cos(a) * 0.15, 0.7, bt.z + Math.sin(a) * 0.15);
            this.stirRod.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        });
        await this.emitDroplets(new THREE.Vector3(bt.x + 0.05, 1.7, bt.z), 16, 0xffd166, {
            target: 'beaker', interval: 90,
            onLand: () => { n++; this.setBeakerVolume(55 + n * 0.6); this.setBeakerColor(c0.clone().lerp(c1, n / 16).getHex()); }
        });
        await stir;
        await this.moveTo(b, new THREE.Vector3(2.3, 0, 0.3), 0.6, new THREE.Vector3(0, 0, 0));
    }
    steam(x, y, z) {
        const m = toon(new THREE.SphereGeometry(rnd(0.08, 0.16), 8, 6), 0xffffff, { thickness: 0.015, transparent: true, opacity: 0.85 });
        m.position.set(x, y, z);
        this.scene.add(m);
        const vx = rnd(-0.3, 0.3), vz = rnd(-0.3, 0.3);
        this.tween(rnd(1.2, 2.0), (k, raw) => {
            m.position.set(x + vx * raw, y + raw * 1.6, z + vz * raw);
            m.scale.setScalar(1 + raw * 1.5);
            m.material.opacity = 0.85 * (1 - k);
        }, () => this.scene.remove(m));
    }

    // ================= ANA DONGU =================
    loop() {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.05, this.clock.getDelta());
        this.world.step(1 / 60, dt, 4);
        for (const d of this.dynamics) {
            if (!d.mesh) continue;
            d.mesh.position.copy(d.body.position);
            d.mesh.quaternion.copy(d.body.quaternion);
        }
        this.updateGrainPool();
        // Piset sikma: boyun uzerinde tutuldugu surece damla akar
        if (this.squeezing && this.mode === 'water') {
            this.dropTimer += dt;
            if (this.dropTimer > 0.07) {
                this.dropTimer = 0;
                const t = this.washBottle.userData.tip.getWorldPosition(new THREE.Vector3());
                const ft = this.flaskTarget;
                this.spawnDroplet(ft.x + rnd(-0.03, 0.03), Math.min(t.y, 2.3), ft.z + rnd(-0.03, 0.03), 0x7ec8f7, {
                    target: 'flask',
                    onLand: () => { this.flaskWaterVol += this.waterPerDrop; this.updateFlaskLiquid(); if (this.onPour) this.onPour('water', this.waterPerDrop); }
                });
            }
        }
        // Damla isleme
        for (const d of [...this.droplets]) {
            d.life += dt;
            const p = d.body.position;
            let absorbed = false;
            if (d.target && d.life > d.minLife) {
                const c = d.target === 'flask' ? this.flaskTarget : this.beakerTarget;
                const lvl = d.target === 'flask' ? this.flaskLevelY : this.beakerLevelY;
                const dx = p.x - c.x, dz = p.z - c.z;
                const inside = dx * dx + dz * dz < c.r * c.r && p.y < (d.target === 'flask' ? 2.2 : c.topY);
                if (inside && (p.y < Math.max(lvl, 0.05) + 0.07 || d.body.velocity.length() < 0.8 || d.life > 1.5)) absorbed = true;
            }
            if (absorbed) { if (d.onLand) d.onLand(); this.removeDynamic(d); }
            else if (p.y < -1.3 || d.life > d.maxLife) this.removeDynamic(d);
        }
        for (const g of [...this.grains]) if (g.body.position.y < -1.3) this.removeDynamic(g);
        for (const t of [...this.tweens]) {
            t.t += dt;
            const raw = Math.min(1, t.t / t.dur);
            t.fn(easeInOut(raw), raw);
            if (raw >= 1) { const i = this.tweens.indexOf(t); if (i >= 0) this.tweens.splice(i, 1); if (t.onDone) t.onDone(); }
        }
        if (this.mode === 'weigh') this.balanceLabel.element.textContent = this.getPanMass().toFixed(2) + ' g';
        if (this.onTick) this.onTick();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }
}

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const $ = id => document.getElementById(id);
const view = $("threeView");

let scene, camera, renderer, controls, truckRoot, showroomRoot;
let lastViewAspect = 1.55;
let partGroups = new Map();
let exploded = false;
let showroomMode = false;
let selectedPart = null;
const removedParts = new Set();
const animationClock = new THREE.Clock();
let wheelAnimation = false;
let animatedWheels = [];
let steeringWheels = [];
let animatedWipers = [];
let animatedTurnSignals = [];
let animatedBrakeLights = [];
let switchableLightMaterials = [];
let headlightLights = [];
let showroomVehicles = [];
let driveTime = 0;
let vehicleLightsEnabled = false;

const partDefinitions = [];

const truckCatalog = [
  ["Kenworth", "T200,T280,T480,T600,T680,T800,T880,TW1000", "north-american"],
  ["Chevrolet", "NHR,NKR,NPR,NQR,FRR,FVR,FVZ", "medium"],
  ["Hino", "300,500,700", "medium"],
  ["Foton", "Aumark,Auman,Auman EST,Auman GTL,Auman GT", "medium"],
  ["JAC", "JHR,JKR,JKR Power,N-Series", "medium"],
  ["JMC", "Carrying,Conquer", "medium"],
  ["Mitsubishi Fuso", "Canter,Fighter", "medium"],
  ["Hyundai", "Mighty,Pavise", "medium"],
  ["Dongfeng", "Captain,KC", "medium"],
  ["Isuzu", "NPR,NQR,FTR", "medium"],
  ["Volkswagen", "Delivery,Constellation", "medium"],
  ["Iveco", "Daily,Tector,Stralis,Stralis Hi-Way", "european"],
  ["Freightliner", "Cascadia,Columbia,M2", "north-american"],
  ["International", "LT,ProStar,9200,9400", "north-american"],
  ["Scania", "R (2009),R450,R500,R560,Streamline,R NexGen (2016),S NexGen (2016),G410", "european"],
  ["Volvo", "FH16 (2009),FH (2012),FH NexGen,FH,FM,FMX", "european"],
  ["DAF", "XF 105,XF,XG,XG+,XD,XF410,XF430,XF530", "european"],
  ["Shacman", "X3000,X5000,F3000", "north-american"],
  ["FAW", "J6P,JH6", "north-american"],
  ["Sinotruk", "HOWO,SITRAK G7H", "north-american"],
  ["Mercedes-Benz", "Actros (2009),New Actros (2014),Actros,Arocs", "european"],
  ["Renault Trucks", "Premium Selection,Magnum,T Range,E-Tech T", "european"],
  ["MAN", "TGX Euro 5,TGX Euro 6,TGX TG3", "european"]
].map(([brand, models, cabStyle]) => ({
  brand,
  cabStyle,
  models: models.split(",").map(model => ({
    id: `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/g, ""),
    name: model,
    profile: cabStyle === "medium" ? "medium" : cabStyle === "european" ? "european" : "north-american"
  }))
}));

const trailerCatalog = [
  ["Plataforma / plancha", "flatbed", "open", 1350],
  ["Cama baja / lowboy", "lowbed", "low", 1200],
  ["Furgón / dry van", "dry-van", "box", 1360],
  ["Refrigerado", "refrigerated", "refrigerated", 1360],
  ["Cisterna / tanque", "tanker", "tanker", 1200],
  ["Food Tanker", "food-tanker", "tanker", 1200],
  ["Chemical Tanker", "chemical-tanker", "tanker", 1200],
  ["Fuel Tanker", "fuel-tanker", "tanker", 1200],
  ["Gas Tanker", "gas-tanker", "tanker", 1200],
  ["Volco / tipper", "tipper", "tipper", 900],
  ["Dumper / Tipper", "dumper-tipper", "tipper", 900],
  ["Portacontenedores", "container", "container", 1200],
  ["Container Carrier", "container-carrier", "container", 1200],
  ["Ganadero", "livestock", "livestock", 1350],
  ["Forestal / maderero", "logging", "logging", 1100],
  ["Silo / granelero", "silo", "silo", 1200],
  ["Extensible", "extendable", "extendable", 1600],
  ["Lowloader", "lowloader", "low", 1200],
  ["Isolated Trailer", "isolated-trailer", "box", 1360],
  ["Curtainsider / Walking Floor", "walking-floor", "curtainsider", 1360],
  ["Estacas / curtainsider", "curtainsider", "curtainsider", 1360],
  ["Krone Boxliner", "krone-boxliner", "container", 1360],
  ["Krone Cool Liner", "krone-cool-liner", "refrigerated", 1360],
  ["Krone Dry Liner", "krone-dry-liner", "box", 1360],
  ["Krone Profi Liner", "krone-profi-liner", "curtainsider", 1360],
  ["Krone Paper Liner", "krone-paper-liner", "curtainsider", 1360],
  ["Schmitz S.KO Cool", "schmitz-sko-cool", "refrigerated", 1360],
  ["Schmitz S.BO Express", "schmitz-sbo-express", "box", 1360],
  ["Schmitz S.KI Solid", "schmitz-ski-solid", "tipper", 900],
  ["Wielton Curtainsider", "wielton-curtainsider", "curtainsider", 1360],
  ["Wielton Dropside", "wielton-dropside", "tipper", 900],
  ["Wielton Box", "wielton-box", "box", 1360],
  ["Wielton Tipper", "wielton-tipper", "tipper", 900],
  ["Wielton Container Carrier", "wielton-container", "container", 1200],
  ["Tirsan Bulk Liner", "tirsan-bulk-liner", "silo", 1200],
  ["Tirsan Curtainsider", "tirsan-curtainsider", "curtainsider", 1360],
  ["Tirsan Container Carrier", "tirsan-container", "container", 1200]
].map(([name, id, style, length]) => ({ name, id, style, length }));

function getTruckModel() {
  for (const brand of truckCatalog) {
    const model = brand.models.find(item => item.id === $("truckType").value);
    if (model) return { ...model, brand: brand.brand, cabStyle: brand.cabStyle };
  }
  return { id: "kenworth-t800", name: "T800", brand: "Kenworth", profile: "north-american", cabStyle: "north-american" };
}

function getTrailer() {
  return trailerCatalog.find(item => item.id === $("trailerType").value) || trailerCatalog[0];
}

function populateModelSelectors() {
  const truckSelect = $("truckType");
  truckSelect.replaceChildren();

  truckCatalog.forEach(brand => {
    const group = document.createElement("optgroup");
    group.label = brand.brand;
    brand.models.forEach(model => {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${brand.brand} ${model.name}`;
      group.appendChild(option);
    });
    truckSelect.appendChild(group);
  });
  truckSelect.value = "kenworth-t800";

  const trailerSelect = $("trailerType");
  trailerSelect.replaceChildren();
  trailerCatalog.forEach(trailer => {
    const option = document.createElement("option");
    option.value = trailer.id;
    option.textContent = trailer.name;
    trailerSelect.appendChild(option);
  });
  trailerSelect.value = "flatbed";
}

function applyReferenceDimensions() {
  const model = getTruckModel();
  const trailer = getTrailer();
  const cabLength = model.profile === "medium"
    ? 650
    : model.profile === "european"
      ? 600
      : 750;
  const trailerLength = trailer.length;
  const totalLength = cabLength + trailerLength;
  const totalHeight = trailer.style === "low" ? 370 : 400;

  $("realLength").value = String(totalLength);
  $("realWidth").value = String(model.profile === "medium" ? 245 : 255);
  $("realHeight").value = String(totalHeight);
  $("modelCaption").textContent =
    `${model.brand} ${model.name} + ${trailer.name.toLowerCase()} · dimensiones de referencia editables`;
}

const fmt = n => Number(n).toLocaleString("es-CO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const mat = (color, roughness = .72, metalness = .05) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });

function makeBumpTexture(draw, width = 256, height = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  return texture;
}

const rubberBump = makeBumpTexture((context, width, height) => {
  context.fillStyle = "#808080";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#333333";
  context.lineWidth = 9;
  for (let x = -height; x < width + height; x += 34) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + height * .48, height);
    context.stroke();
  }
  context.strokeStyle = "#c8c8c8";
  context.lineWidth = 3;
  for (let y = 16; y < height; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
});

const metalBump = makeBumpTexture((context, width, height) => {
  context.fillStyle = "#808080";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#a0a0a0";
  context.lineWidth = 1;
  for (let y = 2; y < height; y += 7) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
});

const concreteBump = makeBumpTexture((context, width, height) => {
  context.fillStyle = "#777777";
  context.fillRect(0, 0, width, height);
  for (let i = 0; i < 1800; i++) {
    const shade = 75 + Math.floor(Math.random() * 100);
    context.fillStyle = `rgb(${shade},${shade},${shade})`;
    context.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
  }
}, 256, 256);

const brandPaints = new Map();
const badgePaints = new Map();
const brandPaintColors = {
  Kenworth: "#164d78",
  Scania: "#8e2630",
  Volvo: "#183e65",
  DAF: "#17657b",
  "Mercedes-Benz": "#3e505f",
  MAN: "#b7c5cf",
  "Renault Trucks": "#b72e32",
  Iveco: "#ece9df",
  Freightliner: "#335d7e",
  International: "#41634d"
};

function getCabPaint(brand) {
  if (!brandPaints.has(brand)) {
    brandPaints.set(brand, new THREE.MeshPhysicalMaterial({
      color: brandPaintColors[brand] || "#24608a",
      roughness: .27,
      metalness: .28,
      clearcoat: .9,
      clearcoatRoughness: .17
    }));
  }
  return brandPaints.get(brand);
}

function getBadgeMaterial(brand, model) {
  const key = `${brand}-${model}`;
  if (!badgePaints.has(key)) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#111820");
    gradient.addColorStop(.5, "#3b4b58");
    gradient.addColorStop(1, "#111820");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#e3e9ee";
    context.font = "700 48px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`${brand} ${model}`, 256, 65);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    badgePaints.set(key, new THREE.MeshStandardMaterial({
      map: texture,
      metalness: .48,
      roughness: .34
    }));
  }
  return badgePaints.get(key);
}

const materials = {
  blue: getCabPaint(""),
  blueDark: getCabPaint("Kenworth"),
  glass: new THREE.MeshPhysicalMaterial({
    color: "#8bc8e8",
    roughness: .12,
    metalness: .24,
    clearcoat: 1,
    clearcoatRoughness: .08,
    transparent: true,
    opacity: .48,
    depthWrite: false
  }),
  black: mat("#171d26"),
  rubber: new THREE.MeshStandardMaterial({
    color: "#202124",
    roughness: .88,
    metalness: 0,
    bumpMap: rubberBump,
    bumpScale: .025
  }),
  metal: new THREE.MeshStandardMaterial({
    color: "#8996a5",
    roughness: .32,
    metalness: .7,
    bumpMap: metalBump,
    bumpScale: .012
  }),
  silver: new THREE.MeshPhysicalMaterial({
    color: "#c4d0dc",
    roughness: .24,
    metalness: .78,
    clearcoat: .45,
    bumpMap: metalBump,
    bumpScale: .008
  }),
  chrome: new THREE.MeshPhysicalMaterial({
    color: "#d9e3ec",
    roughness: .16,
    metalness: .9,
    clearcoat: .8
  }),
  white: mat("#e7edf3"),
  headlight: new THREE.MeshStandardMaterial({
    color: "#fff2b0",
    emissive: "#ffcb4b",
    emissiveIntensity: 1.2,
    roughness: .25
  }),
  turnSignal: new THREE.MeshStandardMaterial({
    color: "#ff9d38",
    emissive: "#d94e0b",
    emissiveIntensity: .65,
    roughness: .3
  }),
  brakeLight: new THREE.MeshStandardMaterial({
    color: "#bd2525",
    emissive: "#e11d1d",
    emissiveIntensity: .2,
    roughness: .28
  }),
  red: mat("#c83b36"),
  yellow: mat("#f5c542"),
  seat: mat("#303d50"),
  wood: mat("#a97845")
};

function setVehicleLights(enabled) {
  vehicleLightsEnabled = enabled;
  switchableLightMaterials.forEach(({ material, offIntensity, onIntensity }) => {
    material.emissiveIntensity = enabled ? onIntensity : offIntensity;
  });
  animatedTurnSignals.forEach(({ material, runningIntensity }) => {
    material.emissiveIntensity = enabled ? runningIntensity : .08;
  });
  animatedBrakeLights.forEach(material => {
    material.emissiveIntensity = enabled ? .42 : .2;
  });
  headlightLights.forEach(light => {
    light.visible = enabled;
  });

  const button = $("lightsBtn");
  button.setAttribute("aria-pressed", String(enabled));
  button.classList.toggle("active", enabled);
  button.textContent = enabled ? "Apagar luces" : "Encender luces";
}

// INICIAR ESCENA 3D

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#111a24");
  scene.fog = new THREE.Fog("#111a24", 24, 58);

  camera = new THREE.PerspectiveCamera(
    42,
    view.clientWidth / view.clientHeight,
    .1,
    1000
  );

  camera.position.set(10, 8, 12);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.setSize(
    view.clientWidth,
    view.clientHeight
  );

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  view.prepend(renderer.domElement);
  const environment = new RoomEnvironment();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmremGenerator.fromScene(environment);
  scene.environment = environmentMap.texture;
  pmremGenerator.dispose();
  environment.dispose();

  controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.target.set(0, 1.1, 0);
  controls.maxPolarAngle = Math.PI * .49;

  scene.add(
    new THREE.HemisphereLight(
      0xb9d8f5,
      0x27364b,
      1.65
    )
  );

  const key = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  key.position.set(7, 12, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 14;
  key.shadow.camera.bottom = -14;
  key.shadow.bias = -.0002;
  scene.add(key);

  const fill = new THREE.DirectionalLight(
    0x9bc7e8,
    1.05
  );

  fill.position.set(-8, 5, -6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe6c6, 1.25);
  rim.position.set(-5, 8, 9);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      color: "#252d35",
      roughness: .92,
      metalness: .04,
      bumpMap: concreteBump,
      bumpScale: .018
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.04;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(
    30,
    30,
    "#63717e",
    "#46515c"
  );

  grid.position.y = -.025;
  grid.material.transparent = true;
  grid.material.opacity = .34;
  scene.add(grid);

  buildTruck();

  $("loading").style.display = "none";

  window.addEventListener("resize", onResize);

  animate();
}

// AJUSTAR PANTALLA

function onResize() {
  if (!renderer) return;

  const aspect = view.clientWidth / view.clientHeight;
  const zoomScale = lastViewAspect / aspect;
  camera.position.sub(controls.target).multiplyScalar(zoomScale).add(controls.target);
  lastViewAspect = aspect;
  camera.aspect = aspect;

  camera.updateProjectionMatrix();

  renderer.setSize(
    view.clientWidth,
    view.clientHeight
  );
}

// ANIMACIÓN

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(animationClock.getDelta(), .05);

  for (const [key, group] of partGroups) {
    const target = exploded || removedParts.has(key)
      ? group.userData.exploded
      : group.userData.home;

    group.position.lerp(target, .09);
    if (wheelAnimation && !exploded && !removedParts.has(key)) {
      if (key === "Cabina") {
        group.position.y = target.y + Math.sin(driveTime * 8) * .009;
        group.rotation.x = Math.sin(driveTime * 4) * .003;
      } else if (key === "Carrocería") {
        group.position.y = target.y + Math.sin(driveTime * 8 - .35) * .005;
      }
    } else if (key === "Cabina" || key === "Carrocería") {
      group.rotation.x = 0;
    }
  }

  if (showroomMode) {
    if (wheelAnimation) {
      driveTime += delta;
      showroomVehicles.forEach((vehicle, index) => {
        vehicle.root.rotation.y = Math.sin(driveTime * .55 + index * .7) * .075;
        vehicle.wheels.forEach(wheel => {
          wheel.rotation.x -= delta * 1.8;
        });
      });
    } else {
      showroomVehicles.forEach(vehicle => {
        vehicle.root.rotation.y = 0;
      });
    }
  } else if (wheelAnimation) {
    driveTime += delta;
    const steering = Math.sin(driveTime * .68);
    truckRoot.position.x = Math.sin(driveTime * .34) * truckRoot.userData.driveDistance;
    truckRoot.position.z = Math.sin(driveTime * .68) * truckRoot.userData.driveDistance * .22;
    truckRoot.rotation.y = steering * .045;
    truckRoot.rotation.z = Math.sin(driveTime * 2.2) * .003;
    animatedWheels.forEach(wheel => {
      wheel.rotation.x -= delta * truckRoot.userData.wheelAngularSpeed;
    });
    steeringWheels.forEach(wheel => {
      wheel.rotation.y = steering * .11;
    });
    animatedWipers.forEach((wiper, index) => {
      wiper.rotation.z = Math.sin(driveTime * 1.4 + index * .12) * .07;
    });
    const signalPulse = Math.sin(driveTime * 5.2) > 0 ? 1.35 : .08;
    animatedTurnSignals.forEach(({ side, material, runningIntensity }) => {
      material.emissiveIntensity =
        Math.abs(steering) > .45 && Math.sign(steering) === side
          ? signalPulse
          : vehicleLightsEnabled ? runningIntensity : .08;
    });
    const braking = Math.abs(Math.cos(driveTime * .34)) > .96;
    animatedBrakeLights.forEach(material => {
      material.emissiveIntensity = braking ? 1.35 : vehicleLightsEnabled ? .42 : .2;
    });
    truckRoot.position.y = Math.sin(driveTime * 8) * .004;
  } else if (truckRoot) {
    truckRoot.position.set(0, 0, 0);
    truckRoot.rotation.set(0, 0, 0);
    steeringWheels.forEach(wheel => {
      wheel.rotation.y = 0;
    });
    animatedWipers.forEach(wiper => {
      wiper.rotation.z = 0;
    });
    animatedTurnSignals.forEach(({ material, runningIntensity }) => {
      material.emissiveIntensity = vehicleLightsEnabled ? runningIntensity : .08;
    });
    animatedBrakeLights.forEach(material => {
      material.emissiveIntensity = vehicleLightsEnabled ? .42 : .2;
    });
  }

  controls.update();
  renderer.render(scene, camera);
}

// CREAR PIEZAS RECTANGULARES

function addBox(parent, name, dim, pos, material, groupKey = name) {
  const g = partGroups.get(groupKey);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...dim),
    material
  );

  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.partKey = groupKey;

  g.add(mesh);

  return mesh;
}

// CREAR GRUPOS DE PIEZAS

function makeGroup(
  key,
  description,
  measurement,
  quantity,
  material,
  home,
  explode
) {
  const group = new THREE.Group();

  group.name = key;

  group.userData = {
    home: new THREE.Vector3(...home),
    exploded: new THREE.Vector3(...explode),
    description,
    measurement,
    quantity,
    material
  };

  group.position.copy(group.userData.home);

  truckRoot.add(group);
  partGroups.set(key, group);

  partDefinitions.push({
    key,
    name: key,
    description,
    measurement,
    quantity,
    material
  });

  return group;
}

// CONSTRUIR CAMIÓN 3D

function buildTruck({ updateInterface = true, updateCamera = true } = {}) {
  if (truckRoot) {
    scene.remove(truckRoot);

    truckRoot.traverse(o => {
      if (o.geometry) o.geometry.dispose();
    });
  }

  const disposableMaterials = new Set([
    ...switchableLightMaterials.map(({ material }) => material),
    ...animatedTurnSignals.map(({ material }) => material),
    ...animatedBrakeLights
  ]);
  disposableMaterials.forEach(material => material.dispose());

  partGroups = new Map();
  partDefinitions.length = 0;
  animatedWheels = [];
  steeringWheels = [];
  animatedWipers = [];
  animatedTurnSignals = [];
  animatedBrakeLights = [];
  switchableLightMaterials = [];
  headlightLights = [];
  driveTime = 0;
  removedParts.clear();
  exploded = false;

  truckRoot = new THREE.Group();
  scene.add(truckRoot);

  const s = Number($("scale").value);

  const L = Number($("realLength").value) / s / 10;
  const W = Number($("realWidth").value) / s / 10;
  const H = Number($("realHeight").value) / s / 10;
  const truckModel = getTruckModel();
  const trailer = getTrailer();
  const truckType = truckModel.profile;
  const trailerType = trailer.style;

  const t = Number($("woodThickness").value) / 100;

  const len = L;
  const wid = W;
  const hei = H;
  const cabLen = Number($("realLength").value) > 0
    ? Math.min(len * .42, (truckType === "medium" ? 650 : truckType === "european" ? 600 : 750) / s / 10)
    : len * .35;
  const boxLen = Math.min(len - cabLen, trailer.length / s / 10);
  const wheelR = hei * .105;
  truckRoot.userData.driveDistance = len * .012;
  truckRoot.userData.turnRadius = len * 1.2;
  truckRoot.userData.wheelAngularSpeed =
    (truckRoot.userData.turnRadius * .05) / wheelR;

  const zFront = len / 2 - cabLen / 2;
  const zBox = -len / 2 + boxLen / 2;

  const yBase = wheelR * 2;

  const boxHeight = hei * (
    trailerType === "low" || trailerType === "open" || trailerType === "extendable"
      ? .28
      : trailerType === "tipper"
        ? .52
        : trailerType === "tanker"
          ? .60
          : .72
  );
  const cabHeight = hei * .70;
  const cabMaterial = getCabPaint(truckModel.brand);

  // CHASIS

  makeGroup(
    "Chasis",
    "Estructura inferior que sostiene la cabina, carrocería y ejes.",
    `${fmt(len * 10)} × ${fmt(wid * .13 * 10)} × ${fmt(t * 10)} cm`,
    1,
    "Madera / listón",
    [0, 0, 0],
    [0, -.6, 0]
  );

  const chassis = partGroups.get("Chasis");

  addBox(
    chassis,
    "larguero",
    [wid * .10, t, len * .94],
    [-wid * .36, yBase, 0],
    materials.metal,
    "Chasis"
  );

  addBox(
    chassis,
    "larguero",
    [wid * .10, t, len * .94],
    [wid * .36, yBase, 0],
    materials.metal,
    "Chasis"
  );

  for (let i = 0; i < 4; i++) {
    addBox(
      chassis,
      "travesaño",
      [wid * .82, t * 1.1, wid * .07],
      [0, yBase, -len * .40 + i * len * .27],
      materials.metal,
      "Chasis"
    );
  }

  // CABINA

  makeGroup(
    "Cabina",
    `Cabina de referencia: ${truckModel.brand} ${truckModel.name}. La silueta es conceptual y no sustituye un plano oficial del fabricante.`,
    `${fmt(cabLen * 10)} × ${fmt(wid * 10)} × ${fmt(cabHeight * 10)} cm`,
    1,
    "Madera / contrachapado",
    [0, 0, 0],
    [0, .55, len * .12]
  );

  const cab = partGroups.get("Cabina");
  const cabZ = zFront;

  const cabProfile = new THREE.Shape();
  const cabLengthFactor = cabLen;
  const cabHeightFactor = cabHeight;
  const outline = truckType === "north-american"
    ? [
      [-.50, .045], [-.50, .19], [-.48, .24], [-.41, .28],
      [-.30, .32], [-.27, .39], [-.24, .66], [-.20, .78],
      [-.12, .91], [-.02, .975], [.20, .985], [.35, .985],
      [.405, .96], [.465, .91], [.49, .84], [.49, .12],
      [.455, .055], [.40, .035]
    ]
    : truckType === "european"
      ? [
        [-.50, .045], [-.50, .72], [-.48, .82], [-.44, .91],
        [-.36, .97], [-.27, .985], [.29, .985], [.37, .965],
        [.445, .91], [.49, .82], [.49, .12], [.455, .055],
        [.40, .035]
      ]
      : [
        [-.50, .045], [-.50, .72], [-.47, .83], [-.40, .92],
        [-.30, .975], [-.20, .985], [.28, .985], [.38, .96],
        [.46, .89], [.49, .79], [.49, .12], [.455, .055],
        [.40, .035]
      ];

  outline.forEach(([x, y], index) => {
    const point = new THREE.Vector2(x * cabLengthFactor, y * cabHeightFactor);
    if (index === 0) cabProfile.moveTo(point.x, point.y);
    else cabProfile.lineTo(point.x, point.y);
  });
  cabProfile.closePath();

  const cabShell = new THREE.Mesh(
    new THREE.ExtrudeGeometry(cabProfile, {
      depth: wid * .92,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: Math.min(wid * .024, .04),
      bevelThickness: Math.min(wid * .024, .04),
      curveSegments: 8
    }),
    cabMaterial
  );
  cabShell.geometry.translate(0, 0, -wid * .46);
  cabShell.geometry.rotateY(Math.PI / 2);
  cabShell.position.set(0, yBase, cabZ);
  cabShell.castShadow = true;
  cabShell.receiveShadow = true;
  cabShell.userData.partKey = "Cabina";
  cab.add(cabShell);

  const windshield = addBox(
    cab,
    "parabrisas",
    [wid * .70, cabHeight * (truckType === "north-american" ? .29 : .22), .025],
    [
      0,
      yBase + cabHeight * (truckType === "north-american" ? .535 : .84),
      cabZ + cabLen * (truckType === "north-american" ? .27 : .49)
    ],
    truckType === "european"
      ? new THREE.MeshPhysicalMaterial({
        color: "#78b9d1",
        roughness: .12,
        metalness: .18,
        clearcoat: 1,
        transparent: true,
        opacity: .84,
        depthWrite: false,
        side: THREE.DoubleSide
      })
      : materials.glass,
    "Cabina"
  );
  windshield.renderOrder = 2;
  windshield.rotation.x = truckType === "north-american" ? -.42 : -.35;

  const windshieldY = yBase + cabHeight * (truckType === "north-american" ? .535 : .84);
  const windshieldZ = cabZ + cabLen * (truckType === "north-american" ? .27 : .49);
  const windshieldHeight = cabHeight * (truckType === "north-american" ? .29 : .22);
  const windshieldFrame = new THREE.Mesh(
    new THREE.BoxGeometry(.018, windshieldHeight * .92, .018),
    materials.black
  );
  windshieldFrame.position.set(0, windshieldY, windshieldZ + .025);
  windshieldFrame.rotation.x = windshield.rotation.x;
  windshieldFrame.userData.partKey = "Cabina";
  cab.add(windshieldFrame);

  for (const side of [-1, 1]) {
    const wiper = new THREE.Group();
    wiper.position.set(
      side * wid * .10,
      windshieldY - windshieldHeight * .34,
      windshieldZ + .04
    );
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(.016, windshieldHeight * .72, .014),
      materials.black
    );
    arm.position.y = windshieldHeight * .34;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .29, .018, .016),
      materials.black
    );
    blade.position.set(side * wid * .09, windshieldHeight * .67, 0);
    blade.rotation.z = side * -.16;
    wiper.add(arm, blade);
    wiper.rotation.x = windshield.rotation.x;
    wiper.userData.partKey = "Cabina";
    cab.add(wiper);
    animatedWipers.push(wiper);
  }

  for (const side of [-1, 1]) {
    const sideWindowFrame = addBox(
      cab,
      "marco de ventana lateral",
      [.026, cabHeight * .235, cabLen * .275],
      [side * wid * .478, yBase + cabHeight * .78, cabZ - cabLen * .21],
      materials.black,
      "Cabina"
    );
    sideWindowFrame.rotation.y = side < 0 ? -.035 : .035;

    const sideWindow = addBox(
      cab,
      "ventana lateral",
      [.014, cabHeight * .205, cabLen * .24],
      [side * wid * .493, yBase + cabHeight * .78, cabZ - cabLen * .21],
      materials.glass,
      "Cabina"
    );
    sideWindow.rotation.y = side < 0 ? -.035 : .035;
    sideWindow.renderOrder = 3;

    addBox(
      cab,
      "manija de puerta",
      [.025, .055, .13],
      [side * wid * .475, yBase + cabHeight * .33, cabZ - cabLen * .16],
      materials.chrome,
      "Cabina"
    );

    addBox(
      cab,
      "junta de puerta",
      [.014, cabHeight * .47, .018],
      [side * wid * .466, yBase + cabHeight * .30, cabZ - cabLen * .17],
      materials.black,
      "Cabina"
    );

    addBox(
      cab,
      "moldura lateral",
      [.018, .035, cabLen * .28],
      [side * wid * .467, yBase + cabHeight * .22, cabZ - cabLen * .19],
      materials.chrome,
      "Cabina"
    );

    for (const hingeHeight of [.16, .40, .64]) {
      const hinge = new THREE.Mesh(
        new THREE.CylinderGeometry(.018, .018, cabHeight * .045, 10),
        materials.chrome
      );
      hinge.position.set(
        side * wid * .469,
        yBase + cabHeight * hingeHeight,
        cabZ - cabLen * .34
      );
      hinge.userData.partKey = "Cabina";
      cab.add(hinge);
    }
  }

  const badgeMaterial = getBadgeMaterial(truckModel.brand, truckModel.name);
  for (const side of [-1, 1]) {
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(wid * .27, cabHeight * .05),
      badgeMaterial
    );
    badge.position.set(
      side * wid * .474,
      yBase + cabHeight * .43,
      cabZ - cabLen * .18
    );
    badge.rotation.y = side * Math.PI / 2;
    badge.userData.partKey = "Cabina";
    cab.add(badge);
  }

  // INTERIOR

  addBox(
    cab,
    "tablero",
    [wid * .78, cabHeight * .055, cabLen * .10],
    [0, yBase + cabHeight * .34, cabZ + cabLen * .24],
    materials.black,
    "Cabina"
  );

  addBox(
    cab,
    "asiento conductor",
    [wid * .25, cabHeight * .24, cabLen * .19],
    [-wid * .22, yBase + cabHeight * .22, cabZ - cabLen * .08],
    materials.seat,
    "Cabina"
  );

  addBox(
    cab,
    "asiento acompañante",
    [wid * .25, cabHeight * .24, cabLen * .19],
    [wid * .22, yBase + cabHeight * .22, cabZ - cabLen * .08],
    materials.seat,
    "Cabina"
  );

  const steering = new THREE.Mesh(
    new THREE.TorusGeometry(wid * .075, .018, 8, 24),
    materials.black
  );

  steering.position.set(
    -wid * .22,
    yBase + cabHeight * .42,
    cabZ + cabLen * .19
  );

  steering.rotation.x = Math.PI / 2;
  cab.add(steering);

  if (truckType === "european") {
    addBox(
      cab,
      "deflector de techo",
      [wid * .76, t * 1.2, cabLen * .23],
      [0, yBase + cabHeight * .965, cabZ - cabLen * .24],
      cabMaterial,
      "Cabina"
    );
  }

  // CARROCERÍA

  makeGroup(
    "Carrocería",
    `${trailer.name} acoplado a un tractocamión ${truckModel.brand} ${truckModel.name}.`,
    `${fmt(boxLen * 10)} × ${fmt(wid * 10)} × ${fmt(boxHeight * 10)} cm`,
    1,
    trailerType === "tanker" || trailerType === "silo" ? "Plástico / material cilíndrico" : "Madera / panel",
    [0, 0, 0],
    [0, .75, -len * .18]
  );

  const body = partGroups.get("Carrocería");
  const bodyMaterial = trailerType === "tanker" || trailerType === "silo"
    ? materials.silver
    : trailerType === "tipper"
      ? materials.yellow
      : trailerType === "refrigerated"
        ? materials.white
        : trailerType === "curtainsider"
          ? materials.red
          : trailerType === "container"
            ? materials.blueDark
            : materials.wood;
  const deckY = yBase + (trailerType === "low" ? .02 : boxHeight * .12);
  const bodyCenterY = deckY + boxHeight * .44;
  const wallHeight = boxHeight * (trailerType === "livestock" ? .78 : trailerType === "tipper" ? .88 : .75);

  addBox(
    body,
    trailerType === "low" ? "plataforma baja" : "piso del remolque",
    [wid * .95, t, boxLen],
    [0, deckY, zBox],
    trailerType === "container" ? materials.metal : bodyMaterial,
    "Carrocería"
  );

  if (trailerType === "tanker") {
    const tankRadius = Math.min(wid * .42, boxHeight * .46);
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius, tankRadius, boxLen * .88, 40),
      materials.silver
    );
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, deckY + tankRadius + t, zBox);
    tank.castShadow = true;
    tank.userData.partKey = "Carrocería";
    body.add(tank);

    for (const z of [-boxLen * .30, 0, boxLen * .30]) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(tankRadius * 1.005, Math.max(.018, t * .45), 8, 40),
        materials.metal
      );
      band.rotation.y = Math.PI / 2;
      band.position.set(0, tank.position.y, zBox + z);
      band.userData.partKey = "Carrocería";
      body.add(band);
    }

    const endCap = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius * .94, tankRadius * .94, t * 1.5, 40),
      materials.silver
    );
    endCap.rotation.x = Math.PI / 2;
    for (const z of [-boxLen * .44, boxLen * .44]) {
      endCap.position.set(0, tank.position.y, zBox + z);
      const cap = endCap.clone();
      cap.userData.partKey = "Carrocería";
      body.add(cap);
    }
    const dome = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius * .14, tankRadius * .14, tankRadius * .08, 20),
      materials.metal
    );
    dome.position.set(0, tank.position.y + tankRadius, zBox);
    dome.userData.partKey = "Carrocería";
    body.add(dome);
  } else if (trailerType === "silo") {
    const siloHeight = boxHeight * 1.65;
    const siloRadius = Math.min(wid * .32, boxLen * .1);
    const silo = new THREE.Mesh(
      new THREE.CylinderGeometry(siloRadius * .72, siloRadius, siloHeight, 32),
      materials.silver
    );
    silo.position.set(0, deckY + siloHeight / 2, zBox);
    silo.castShadow = true;
    silo.userData.partKey = "Carrocería";
    body.add(silo);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(siloRadius, boxHeight * .35, 32),
      materials.silver
    );
    cone.rotation.x = Math.PI;
    cone.position.set(0, deckY - boxHeight * .17, zBox);
    cone.userData.partKey = "Carrocería";
    body.add(cone);
  } else if (trailerType === "open" || trailerType === "low" || trailerType === "extendable") {
    if (trailerType === "low") {
      for (const x of [-wid * .4, wid * .4]) {
        addBox(body, "viga de cama baja", [wid * .08, boxHeight * .35, boxLen], [x, deckY + boxHeight * .18, zBox], materials.metal, "Carrocería");
      }
      addBox(body, "rampa trasera", [wid * .72, boxHeight * .55, t * 2], [0, deckY + boxHeight * .22, zBox - boxLen * .48], materials.metal, "Carrocería");
    } else {
      for (let board = 0; board < 8; board++) {
        addBox(body, "travesaño de plataforma", [wid * .94, t * 1.5, boxLen * .025], [0, deckY + t, zBox - boxLen * .47 + board * boxLen * .135], materials.wood, "Carrocería");
      }
    }
    if (trailerType === "open" || trailerType === "extendable") {
      for (const x of [-wid * .45, wid * .45]) {
        addBox(body, "viga de plataforma", [t * 2, t * 2, boxLen], [x, deckY + t * 1.5, zBox], materials.metal, "Carrocería");
      }
    }
    if (trailerType === "extendable") {
      for (const x of [-wid * .35, wid * .35]) {
        addBox(body, "viga extensible", [t * 2, t * 2, boxLen * 1.04], [x, deckY + t * 2, zBox], materials.metal, "Carrocería");
      }
      for (const z of [-boxLen * .3, 0, boxLen * .3]) {
        addBox(body, "travesaño extensible", [wid * .8, t * 1.5, t * 1.5], [0, deckY + t * 2, zBox + z], materials.metal, "Carrocería");
      }
    }
  } else if (trailerType === "tipper") {
    addBox(body, "pared frontal de volco", [wid * .92, wallHeight, t], [0, bodyCenterY, zBox + boxLen * .48], materials.yellow, "Carrocería");
    for (const x of [-wid * .46, wid * .46]) {
      addBox(body, "lateral de volco", [t, wallHeight, boxLen], [x, bodyCenterY, zBox], materials.yellow, "Carrocería");
    }
    addBox(body, "compuerta trasera", [wid * .92, wallHeight * .72, t], [0, bodyCenterY - wallHeight * .12, zBox - boxLen * .48], materials.yellow, "Carrocería");
    for (const x of [-wid * .3, wid * .3]) {
      const ram = new THREE.Mesh(new THREE.CylinderGeometry(t * .55, t * .55, boxHeight * .55, 10), materials.chrome);
      ram.position.set(x, deckY + boxHeight * .28, zBox + boxLen * .18);
      ram.rotation.z = -.25;
      ram.userData.partKey = "Carrocería";
      body.add(ram);
    }
  } else {
    const sideMaterial = trailerType === "curtainsider" ? materials.red : bodyMaterial;
    const roofHeight = trailerType === "livestock" ? boxHeight * .68 : boxHeight * .78;
    const bodyWidth = wid * .92;

    for (const x of [-bodyWidth * .5, bodyWidth * .5]) {
      addBox(body, "lateral del remolque", [t, roofHeight, boxLen], [x, deckY + roofHeight / 2, zBox], sideMaterial, "Carrocería");
      if (trailerType === "livestock") {
        for (let row = 1; row < 5; row++) {
          addBox(body, "barrote ganadero", [t * 1.5, t * 1.5, boxLen], [x * 1.02, deckY + roofHeight * row / 5, zBox], materials.metal, "Carrocería");
        }
      }
      if (["container", "curtainsider", "box", "refrigerated"].includes(trailerType)) {
        const ribCount = trailerType === "container" ? 28 : trailerType === "curtainsider" ? 16 : 12;
        for (let rib = 0; rib < ribCount; rib++) {
          const ribPosition = (rib + .5) / ribCount - .5;
          addBox(
            body,
            "refuerzo lateral",
            [t * 1.1, roofHeight * .96, t * .7],
            [x * 1.035, deckY + roofHeight / 2, zBox + ribPosition * boxLen],
            materials.metal,
            "Carrocería"
          );
        }
      }
    }
    addBox(body, "frente del remolque", [bodyWidth, roofHeight, t], [0, deckY + roofHeight / 2, zBox + boxLen / 2], bodyMaterial, "Carrocería");
    addBox(body, "puertas traseras", [bodyWidth, roofHeight, t], [0, deckY + roofHeight / 2, zBox - boxLen / 2], bodyMaterial, "Carrocería");

    if (trailerType !== "livestock") {
      addBox(body, "techo del remolque", [bodyWidth, t, boxLen], [0, deckY + roofHeight, zBox], bodyMaterial, "Carrocería");
    }
    if (trailerType === "refrigerated") {
      addBox(body, "unidad de refrigeración", [bodyWidth * .45, roofHeight * .44, t * 2], [0, deckY + roofHeight * .74, zBox + boxLen * .51], materials.metal, "Carrocería");
    }
    if (trailerType !== "livestock") {
      const rearDoorZ = zBox - boxLen * .505;
      for (const x of [-bodyWidth * .22, bodyWidth * .22]) {
        const lockBar = new THREE.Mesh(
          new THREE.CylinderGeometry(.014, .014, roofHeight * .88, 10),
          materials.chrome
        );
        lockBar.position.set(x, deckY + roofHeight / 2, rearDoorZ);
        lockBar.userData.partKey = "Carrocería";
        body.add(lockBar);
      }
      for (const x of [-bodyWidth * .43, bodyWidth * .43]) {
        const rearMarker = new THREE.Mesh(
          new THREE.BoxGeometry(bodyWidth * .06, roofHeight * .13, t),
          materials.red
        );
        rearMarker.position.set(x, deckY + roofHeight * .12, rearDoorZ);
        rearMarker.userData.partKey = "Carrocería";
        body.add(rearMarker);
      }
    }
    if (trailerType === "logging") {
      for (let log = 0; log < 5; log++) {
        const timber = new THREE.Mesh(new THREE.CylinderGeometry(wid * .07, wid * .07, boxLen * .9, 12), materials.wood);
        timber.rotation.x = Math.PI / 2;
        timber.position.set((log - 2) * wid * .12, deckY + wid * .1, zBox);
        timber.userData.partKey = "Carrocería";
        body.add(timber);
      }
    }
  }

  if (trailerType !== "tanker" && trailerType !== "silo") {
    addBox(body, "quinta rueda", [wid * .55, t * 1.5, wid * .55], [0, yBase + boxHeight * .08, zBox + boxLen * .43], materials.metal, "Carrocería");
    for (const x of [-wid * .18, wid * .18]) {
      addBox(body, "pata de apoyo", [t, boxHeight * .22, t], [x, yBase + boxHeight * .22, zBox + boxLen * .40], materials.metal, "Carrocería");
    }
  }

  // RUEDAS

  makeGroup(
    "Ruedas",
    "22 ruedas de goma con rines decorativos: una dirección sencilla y cinco ejes dobles.",
    `Diámetro aprox. ${fmt(wheelR * 20)} cm`,
    22,
    "Goma / plástico",
    [0, 0, 0],
    [wid * .75, -.25, 0]
  );

  const wheels = partGroups.get("Ruedas");

  const axlePositions = [
    (cabZ + cabLen * .28) / len,
    (cabZ - cabLen * .12) / len,
    (cabZ - cabLen * .36) / len,
    (zBox - boxLen * .24) / len,
    (zBox - boxLen * .31) / len,
    (zBox - boxLen * .38) / len
  ];
  const wheelPositions = axlePositions.flatMap((z, axleIndex) =>
    [-1, 1].flatMap(side => {
      const offsets = axleIndex === 0
        ? [.52]
        : [.46, .56];
      return offsets.map(offset => [
        side * wid * offset,
        yBase - wheelR,
        len * z
      ]);
    })
  );

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Group();
    wheel.position.set(x, y, z);
    wheel.userData.partKey = "Ruedas";
    wheels.add(wheel);
    animatedWheels.push(wheel);
    if (Math.abs(z - axlePositions[0] * len) < .001) {
      steeringWheels.push(wheel);
    }

    const tire = new THREE.Mesh(
      new THREE.LatheGeometry([
        new THREE.Vector2(wheelR * .57, -wid * .0425),
        new THREE.Vector2(wheelR * .78, -wid * .0425),
        new THREE.Vector2(wheelR * .92, -wid * .038),
        new THREE.Vector2(wheelR * .985, -wid * .027),
        new THREE.Vector2(wheelR, -wid * .015),
        new THREE.Vector2(wheelR, wid * .015),
        new THREE.Vector2(wheelR * .985, wid * .027),
        new THREE.Vector2(wheelR * .92, wid * .038),
        new THREE.Vector2(wheelR * .78, wid * .0425),
        new THREE.Vector2(wheelR * .57, wid * .0425)
      ], 40),
      materials.rubber
    );

    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    tire.userData.partKey = "Ruedas";
    wheel.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(
        wheelR * .52,
        wheelR * .52,
        wid * .09,
        24
      ),
      materials.silver
    );

    rim.rotation.z = Math.PI / 2;
    rim.castShadow = true;
    rim.userData.partKey = "Ruedas";
    wheel.add(rim);

    for (const side of [-1, 1]) {
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelR * .15, wheelR * .15, wid * .14, 20),
        materials.chrome
      );
      hub.rotation.z = Math.PI / 2;
      hub.position.x = side * wid * .065;
      hub.castShadow = true;
      hub.userData.partKey = "Ruedas";
      wheel.add(hub);

      const trimRing = new THREE.Mesh(
        new THREE.TorusGeometry(wheelR * .73, wheelR * .035, 8, 32),
        materials.chrome
      );
      trimRing.rotation.y = Math.PI / 2;
      trimRing.position.x = side * wid * .071;
      trimRing.userData.partKey = "Ruedas";
      wheel.add(trimRing);

      for (let bolt = 0; bolt < 6; bolt++) {
        const angle = bolt * Math.PI / 3;
        const lug = new THREE.Mesh(
          new THREE.SphereGeometry(wheelR * .045, 8, 8),
          materials.metal
        );
        lug.position.set(
          side * wid * .073,
          Math.cos(angle) * wheelR * .42,
          Math.sin(angle) * wheelR * .42
        );
        lug.userData.partKey = "Ruedas";
        wheel.add(lug);
      }
    }
  });

  // EJES

  makeGroup(
    "Ejes",
    "Barras transversales que conectan las ruedas en esta representación de maqueta.",
    `${fmt(wid * 10)} cm de ancho`,
    6,
    "Varilla / madera",
    [0, 0, 0],
    [0, -.9, 0]
  );

  const axles = partGroups.get("Ejes");
  const axleRadius = .0175;

  axlePositions.forEach(ratio => {
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(axleRadius, axleRadius, wid * 1.05, 16),
      materials.metal
    );

    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, yBase - wheelR, len * ratio);
    axle.castShadow = true;
    axle.userData.partKey = "Ejes";
    axles.add(axle);
  });

  axlePositions.forEach((ratio, axleIndex) => {
    const axleZ = len * ratio;
    for (const side of [-1, 1]) {
      const leafLength = axleIndex === 0 ? len * .055 : len * .038;
      for (let leaf = 0; leaf < 3; leaf++) {
        const spring = new THREE.Mesh(
          new THREE.BoxGeometry(wid * .038, .018, leafLength * (1 - leaf * .16)),
          materials.metal
        );
        spring.position.set(
          side * wid * .36,
          yBase - wheelR * (.36 + leaf * .12),
          axleZ
        );
        spring.userData.partKey = "Ejes";
        axles.add(spring);
      }

      const airBag = new THREE.Mesh(
        new THREE.CylinderGeometry(wid * .07, wid * .07, wheelR * .38, 16),
        materials.black
      );
      airBag.position.set(side * wid * .35, yBase - wheelR * .22, axleZ);
      airBag.userData.partKey = "Ejes";
      axles.add(airBag);

      const hanger = new THREE.Mesh(
        new THREE.BoxGeometry(wid * .045, wheelR * .32, wid * .035),
        materials.chrome
      );
      hanger.position.set(side * wid * .35, yBase - wheelR * .52, axleZ);
      hanger.userData.partKey = "Ejes";
      axles.add(hanger);
    }
  });

  // PARACHOQUES

  makeGroup(
    "Parachoques",
    "Pieza frontal y trasera de protección decorativa.",
    `${fmt(wid * 9.5)} × ${fmt(t * 10)} cm`,
    2,
    "Madera / plástico",
    [0, 0, 0],
    [0, .15, len * .58]
  );

  const bump = partGroups.get("Parachoques");

  addBox(
    bump,
    "frontal",
    [wid * 1.02, .16, .12],
    [0, yBase + cabHeight * .05, len * .50],
    materials.silver,
    "Parachoques"
  );

  addBox(
    bump,
    "trasero",
    [wid * 1.02, .16, .12],
    [0, yBase + boxHeight * .08, -len * .49],
    materials.silver,
    "Parachoques"
  );

  // LUCES Y ESPEJOS

  makeGroup(
    "Luces y espejos",
    "Accesorios pequeños: faros, direccionales, espejos y soportes.",
    `Faros aprox. ${fmt(wid * .10 * 10)} cm`,
    1,
    "Plástico / piezas pequeñas",
    [0, 0, 0],
    [wid * .9, .2, len * .38]
  );

  const details = partGroups.get("Luces y espejos");

  for (const x of [-wid * .27, wid * .27]) {
    const headlampBezel = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .15, .16, .055),
      materials.metal
    );
    headlampBezel.position.set(
      x * 1.35,
      yBase + cabHeight * .17,
      len / 2 + wid * .018
    );
    headlampBezel.userData.partKey = "Luces y espejos";
    details.add(headlampBezel);

    const headlampMaterial = materials.headlight.clone();
    headlampMaterial.emissiveIntensity = vehicleLightsEnabled ? 2.2 : .25;
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .105, .12, .028),
      headlampMaterial
    );

    lamp.position.set(
      x * 1.35,
      yBase + cabHeight * .17,
      len / 2 + wid * .052
    );

    lamp.userData.partKey = "Luces y espejos";
    details.add(lamp);
    switchableLightMaterials.push({
      material: headlampMaterial,
      offIntensity: .25,
      onIntensity: 2.2
    });

    const fogLampMaterial = materials.headlight.clone();
    fogLampMaterial.emissiveIntensity = vehicleLightsEnabled ? 1.5 : .12;
    const fogLamp = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .07, .055, .025),
      fogLampMaterial
    );
    fogLamp.position.set(
      x * 1.35,
      yBase + cabHeight * .07,
      len / 2 + wid * .055
    );
    fogLamp.userData.partKey = "Luces y espejos";
    details.add(fogLamp);
    switchableLightMaterials.push({
      material: fogLampMaterial,
      offIntensity: .12,
      onIntensity: 1.5
    });

    const beam = new THREE.SpotLight(0xffedc2, 22, len * 1.45, .38, .62, 2);
    beam.position.set(
      x * 1.35,
      yBase + cabHeight * .17,
      len / 2 + wid * .07
    );
    beam.visible = vehicleLightsEnabled;
    const beamTarget = new THREE.Object3D();
    beamTarget.position.set(
      x * 1.35,
      yBase + cabHeight * .13,
      len / 2 + len * .9
    );
    details.add(beamTarget);
    beam.target = beamTarget;
    beam.userData.partKey = "Luces y espejos";
    details.add(beam);
    headlightLights.push(beam);

    const glow = new THREE.PointLight(0xffedc2, 5, len * .8, 2);
    glow.position.copy(beam.position);
    glow.visible = vehicleLightsEnabled;
    glow.userData.partKey = "Luces y espejos";
    details.add(glow);
    headlightLights.push(glow);

    const indicatorMaterial = materials.turnSignal.clone();
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .06, .06, .025),
      indicatorMaterial
    );
    indicator.position.set(
      x * 1.62,
      yBase + cabHeight * .17,
      len / 2 + wid * .03
    );
    indicator.userData.partKey = "Luces y espejos";
    details.add(indicator);
    animatedTurnSignals.push({
      side: Math.sign(x),
      material: indicatorMaterial,
      runningIntensity: .28
    });

    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(.07, .18, .08),
      materials.silver
    );

    mirror.position.set(
      x * 1.75,
      yBase + cabHeight * .48,
      cabZ + cabLen * .12
    );

    mirror.userData.partKey = "Luces y espejos";
    details.add(mirror);

    const mirrorArm = new THREE.Mesh(
      new THREE.CylinderGeometry(.018, .018, cabHeight * .17, 8),
      materials.metal
    );
    mirrorArm.position.set(
      x * 1.48,
      yBase + cabHeight * .44,
      cabZ + cabLen * .12
    );
    mirrorArm.rotation.z = x < 0 ? -.38 : .38;
    mirrorArm.userData.partKey = "Luces y espejos";
    details.add(mirrorArm);
  }

  for (const side of [-1, 1]) {
    addBox(
      details,
      "manija de puerta",
      [.025, .055, .13],
      [side * wid * .478, yBase + cabHeight * .31, cabZ - cabLen * .10],
      materials.chrome,
      "Luces y espejos"
    );
    addBox(
      details,
      "escalón lateral",
      [wid * .14, .045, cabLen * .38],
      [side * wid * .47, yBase + cabHeight * .035, cabZ - cabLen * .13],
      materials.metal,
      "Luces y espejos"
    );
    for (let tread = 0; tread < 4; tread++) {
      addBox(
        details,
        "relieve antideslizante del escalón",
        [wid * .13, .012, cabLen * .012],
        [
          side * wid * .47,
          yBase + cabHeight * .061,
          cabZ - cabLen * .28 + tread * cabLen * .09
        ],
        materials.chrome,
        "Luces y espejos"
      );
    }
  }

  for (let marker = -1; marker <= 1; marker++) {
    const roofMaterial = materials.headlight.clone();
    roofMaterial.emissiveIntensity = vehicleLightsEnabled ? 1.2 : .12;
    const roofLight = new THREE.Mesh(
      new THREE.SphereGeometry(.055, 12, 8),
      roofMaterial
    );
    roofLight.position.set(
      marker * wid * .28,
      yBase + cabHeight * .97,
      cabZ + cabLen * (truckType === "north-american" ? -.18 : .12)
    );
    roofLight.userData.partKey = "Luces y espejos";
    details.add(roofLight);
    switchableLightMaterials.push({
      material: roofMaterial,
      offIntensity: .12,
      onIntensity: 1.2
    });
  }

  addBox(
    details,
    "marco de parrilla",
    [wid * .42, cabHeight * .16, .045],
    [0, yBase + cabHeight * .18, len / 2 + wid * .025],
    materials.black,
    "Luces y espejos"
  );

  for (let slat = 0; slat < 7; slat++) {
    addBox(
      details,
      "barra vertical de parrilla",
      [wid * .018, cabHeight * .135, .018],
      [wid * (-.15 + slat * .05), yBase + cabHeight * .18, len / 2 + wid * .052],
      materials.chrome,
      "Luces y espejos"
    );
  }
  for (let slat = 0; slat < 3; slat++) {
    addBox(
      details,
      "barra horizontal de parrilla",
      [wid * .40, .018, .02],
      [0, yBase + cabHeight * (.135 + slat * .045), len / 2 + wid * .055],
      materials.silver,
      "Luces y espejos"
    );
  }

  for (const x of [-wid * .35, wid * .35]) {
    const brakeMaterial = materials.brakeLight.clone();
    const rearLamp = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .12, .14, .035),
      brakeMaterial
    );
    rearLamp.position.set(x, yBase + boxHeight * .19, -len * .505);
    rearLamp.userData.partKey = "Luces y espejos";
    details.add(rearLamp);
    animatedBrakeLights.push(brakeMaterial);

    const rearSignalMaterial = materials.turnSignal.clone();
    const rearSignal = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .07, .045, .04),
      rearSignalMaterial
    );
    rearSignal.position.set(
      x,
      yBase + boxHeight * .19 + .085,
      -len * .505 - .012
    );
    rearSignal.userData.partKey = "Luces y espejos";
    details.add(rearSignal);
    animatedTurnSignals.push({
      side: Math.sign(x),
      material: rearSignalMaterial,
      runningIntensity: .28
    });
  }

  for (const side of [-1, 1]) {
    for (const position of [-.32, .02, .34]) {
      const markerMaterial = (position < -.2
        ? materials.brakeLight
        : materials.turnSignal
      ).clone();
      markerMaterial.emissiveIntensity = vehicleLightsEnabled ? .95 : .08;
      const sideMarker = new THREE.Mesh(
        new THREE.BoxGeometry(.035, .055, wid * .055),
        markerMaterial
      );
      sideMarker.position.set(
        side * wid * .49,
        yBase + boxHeight * .2,
        zBox + boxLen * position
      );
      sideMarker.userData.partKey = "Luces y espejos";
      details.add(sideMarker);
      if (position < -.2) {
        animatedBrakeLights.push(markerMaterial);
      } else {
        switchableLightMaterials.push({
          material: markerMaterial,
          offIntensity: .08,
          onIntensity: .95
        });
        animatedTurnSignals.push({
          side,
          material: markerMaterial,
          runningIntensity: .95
        });
      }
    }
  }

  // TANQUES Y ACCESORIOS

  makeGroup(
    "Tanques y accesorios",
    trailerType === "tanker" || trailerType === "silo"
      ? "Escalones, soportes y accesorios exteriores de la cisterna."
      : "Depósitos laterales, escalones, guardabarros y pequeños accesorios.",
    `${fmt(len * .13 * 10)} × ${fmt(wid * .15 * 10)} cm`,
    2,
    "Madera / plástico",
    [0, 0, 0],
    [-wid * .85, .25, -len * .04]
  );

  const extras = partGroups.get("Tanques y accesorios");

  for (const side of [-1, 1]) {
    const fuelTank = new THREE.Mesh(
      new THREE.CylinderGeometry(wid * .105, wid * .105, cabLen * .30, 24),
      materials.silver
    );
    fuelTank.rotation.x = Math.PI / 2;
    fuelTank.position.set(
      side * wid * .38,
      yBase + cabHeight * .11,
      cabZ - cabLen * .12
    );
    fuelTank.userData.partKey = "Tanques y accesorios";
    extras.add(fuelTank);

    for (const ringPosition of [-.32, .32]) {
      const strap = new THREE.Mesh(
        new THREE.TorusGeometry(wid * .105, .018, 6, 24),
        materials.chrome
      );
      strap.position.set(
        side * wid * .38,
        yBase + cabHeight * .11,
        cabZ - cabLen * .12 + cabLen * .15 * ringPosition * 2
      );
      strap.userData.partKey = "Tanques y accesorios";
      extras.add(strap);
    }

    const mudflap = new THREE.Mesh(
      new THREE.BoxGeometry(wid * .22, wheelR * .68, .035),
      materials.rubber
    );
    mudflap.position.set(
      side * wid * .48,
      yBase - wheelR * .72,
      axlePositions[axlePositions.length - 1] * len - wheelR * .8
    );
    mudflap.userData.partKey = "Tanques y accesorios";
    extras.add(mudflap);
  }

  if (truckType === "north-american") {
    for (const side of [-1, 1]) {
      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(wid * .045, wid * .055, cabHeight * .82, 20, 1, true),
        materials.chrome
      );
      exhaust.position.set(
        side * wid * .46,
        yBase + cabHeight * .54,
        cabZ - cabLen * .36
      );
      exhaust.castShadow = true;
      exhaust.userData.partKey = "Tanques y accesorios";
      extras.add(exhaust);

      const exhaustTop = new THREE.Mesh(
        new THREE.CylinderGeometry(wid * .052, wid * .045, cabHeight * .035, 20),
        materials.metal
      );
      exhaustTop.position.set(
        side * wid * .46,
        yBase + cabHeight * .96,
        cabZ - cabLen * .36
      );
      exhaustTop.userData.partKey = "Tanques y accesorios";
      extras.add(exhaustTop);
    }
  }

  for (const z of axlePositions.map(ratio => len * ratio)) {
    for (const xSide of [-1, 1]) {
      const fender = new THREE.Mesh(
        new THREE.TorusGeometry(wheelR * 1.12, Math.max(t * .55, .018), 8, 32, Math.PI),
        cabMaterial
      );
      fender.rotation.y = Math.PI / 2;
      fender.position.set(
        xSide * wid * .56,
        yBase - wheelR,
        z
      );
      fender.castShadow = true;
      fender.userData.partKey = "Tanques y accesorios";
      extras.add(fender);
    }
  }

  if (trailerType === "tanker" || trailerType === "silo") {
    for (const x of [-wid * .48, wid * .48]) {
      addBox(
        extras,
        "escalón lateral",
        [wid * .08, t * 1.5, cabLen * .55],
        [x, yBase + cabHeight * .08, cabZ - cabLen * .12],
        materials.metal,
        "Tanques y accesorios"
      );
    }
  } else {
    for (const x of [-wid * .42, wid * .42]) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(.12, .12, len * .13, 18),
        materials.metal
      );

      tank.rotation.x = Math.PI / 2;
      tank.position.set(
        x,
        yBase + cabHeight * .07,
        cabZ - cabLen * .10
      );

      tank.userData.partKey = "Tanques y accesorios";
      extras.add(tank);
    }
  }

  if (updateInterface) {
    updatePartsTable();
    renderManualParts();
    updateAssemblyStatus();

    $("selectedPartLabel").textContent =
      "Pieza seleccionada: ninguna";

    showPartInfo(null);
  }

  setVehicleLights(vehicleLightsEnabled);

  if (updateCamera) {
    camera.position.set(len * .72, hei * 1.18, len * .79);

    controls.target.set(0, hei * .32, len * .07);
    const aspect = view.clientWidth / view.clientHeight;
    const framingScale = Math.max(1, 1.55 / aspect);
    camera.position.sub(controls.target).multiplyScalar(framingScale).add(controls.target);
    lastViewAspect = aspect;
    controls.update();
  }
}

function addShowroomLabel(text, position, width, selection = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  context.fillStyle = "#071326e8";
  context.beginPath();
  context.roundRect(8, 8, 496, 80, 14);
  context.fill();
  context.strokeStyle = "#75b9ed";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "700 36px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), 256, 49, 470);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  }));
  label.position.set(...position);
  label.scale.set(width, width * .19, 1);
  label.renderOrder = 5;
  if (selection) Object.assign(label.userData, selection);
  showroomRoot.add(label);
}

function frameShowroom() {
  controls.target.set(0, .8, 0);
  camera.position.set(17, 18, 23);
  const aspect = view.clientWidth / view.clientHeight;
  const framingScale = Math.max(1, 1.55 / aspect) * .78;
  camera.position.sub(controls.target).multiplyScalar(framingScale).add(controls.target);
  lastViewAspect = aspect;
  controls.update();
}

function createShowroom() {
  const saved = {
    truck: $("truckType").value,
    trailer: $("trailerType").value,
    scale: $("scale").value,
    length: $("realLength").value,
    width: $("realWidth").value,
    height: $("realHeight").value,
    caption: $("modelCaption").textContent
  };
  const rows = [
    {
      label: "Tractocamiones",
      z: 5.2,
      vehicles: [
        { truck: "kenworth-t800", trailer: "flatbed", label: "Kenworth T800" },
        { truck: "freightliner-cascadia", trailer: "flatbed", label: "Freightliner Cascadia" },
        { truck: "scania-r-nexgen-2016", trailer: "flatbed", label: "Scania R NexGen" },
        { truck: "volvo-fh-nexgen", trailer: "flatbed", label: "Volvo FH NexGen" }
      ]
    },
    {
      label: "Remolques",
      z: -5.2,
      vehicles: [
        { truck: "kenworth-t800", trailer: "dry-van", label: "Furgón" },
        { truck: "kenworth-t800", trailer: "refrigerated", label: "Refrigerado" },
        { truck: "kenworth-t800", trailer: "tanker", label: "Cisterna" },
        { truck: "kenworth-t800", trailer: "lowbed", label: "Cama baja" }
      ]
    }
  ];
  const columns = [-4.5, -1.5, 1.5, 4.5];
  const colorModels = [];
  for (const row of rows) {
    row.vehicles.forEach((vehicle, index) => {
      colorModels.push({ ...vehicle, x: columns[index], z: row.z });
    });
  }

  showroomRoot = new THREE.Group();
  showroomRoot.name = "TruckScaleShowroom";
  showroomRoot.visible = false;
  scene.add(showroomRoot);
  showroomVehicles = [];

  for (const item of colorModels) {
    $("truckType").value = item.truck;
    $("trailerType").value = item.trailer;
    applyReferenceDimensions();
    buildTruck({ updateInterface: false, updateCamera: false });

    const vehicle = truckRoot.clone(true);
    vehicle.traverse(object => {
      if (object.isMesh && object.geometry) {
        object.geometry = object.geometry.clone();
      }
    });
    scene.remove(truckRoot);
    vehicle.position.set(item.x, 0, item.z);
    vehicle.userData.catalogTruckId = item.truck;
    vehicle.userData.catalogTrailerId = item.trailer;
    showroomRoot.add(vehicle);

    const wheels = [];
    vehicle.traverse(object => {
      if (object.isGroup && object.userData.partKey === "Ruedas") {
        wheels.push(object);
      }
    });
    showroomVehicles.push({ root: vehicle, wheels });

    addShowroomLabel(
      item.label,
      [item.x, 2.25, item.z + .1],
      2.15,
      { catalogTruckId: item.truck, catalogTrailerId: item.trailer }
    );
  }

  $("truckType").value = saved.truck;
  $("trailerType").value = saved.trailer;
  $("scale").value = saved.scale;
  applyReferenceDimensions();
  $("realLength").value = saved.length;
  $("realWidth").value = saved.width;
  $("realHeight").value = saved.height;
  $("modelCaption").textContent = saved.caption;
  buildTruck();

  frameShowroom();
}

function setShowroomMode(value) {
  if (value === showroomMode) return;
  if (value && !showroomRoot) createShowroom();

  showroomMode = value;
  showroomRoot.visible = value;
  truckRoot.visible = !value;
  $("showroomBtn").setAttribute("aria-pressed", String(value));
  $("showroomBtn").classList.toggle("active", value);
  $("showroomBtn").textContent = value ? "Volver al camión" : "Galería 3D";
  $("lightsBtn").disabled = value;
  $("showroomHud").hidden = !value;
  document.querySelector(".viewer-card").classList.toggle("showroom-active", value);

  const controlPanel = document.querySelector(".control-panel");
  controlPanel.classList.toggle("showroom-disabled", value);
  controlPanel.querySelectorAll("select, input, button").forEach(control => {
    control.disabled = value;
  });

  if (value) {
    wheelAnimation = false;
    driveTime = 0;
    $("wheelAnimationBtn").setAttribute("aria-pressed", "false");
    $("wheelAnimationBtn").classList.remove("active");
    $("wheelAnimationBtn").textContent = "Rotar modelos";
    frameShowroom();
  } else {
    $("wheelAnimationBtn").textContent = "Animar marcha";
    calculate();
  }
}

// TABLA DE MEDIDAS INDIVIDUALES

function updatePartsTable() {
  const body = $("partsTable");
  body.innerHTML = "";

  const s = Number($("scale").value);
  const L = Number($("realLength").value) / s / 10;
  const W = Number($("realWidth").value) / s / 10;
  const H = Number($("realHeight").value) / s / 10;

  const t = Number($("woodThickness").value) / 100;
  const truckModel = getTruckModel();
  const trailer = getTrailer();
  const truckType = truckModel.profile;
  const trailerType = trailer.style;

  const cabLen = Math.min(L * .42, (truckType === "medium" ? 650 : truckType === "european" ? 600 : 750) / s / 10);
  const boxLen = Math.min(L - cabLen, trailer.length / s / 10);
  const wheelR = H * .105;
  const cabH = H * .70;
  const boxH = H * (
    trailerType === "low" || trailerType === "open" || trailerType === "extendable"
      ? .28
      : trailerType === "tipper"
        ? .52
        : trailerType === "tanker"
          ? .60
          : .72
  );

  const cm = n => fmt(n * 10) + " cm";

  const bodyPieces = [
    [`Piso de ${trailer.name.toLowerCase()}`, `${cm(W*.95)} × ${cm(t)} × ${cm(boxLen)}`, 1, "Contrachapado / perfil metálico", "Carrocería"]
  ];

  if (trailerType === "tanker" || trailerType === "silo") {
    bodyPieces.push(
      [trailerType === "silo" ? "Cuerpo cilíndrico del silo" : "Tanque cilíndrico", `Ø ${cm(Math.min(W*.84, boxH*.92))} × ${cm(boxLen*.88)}`, 1, "Tubo / piezas curvas", "Carrocería"],
      ["Bandas y soportes del tanque", `Ø ${cm(Math.min(W*.84, boxH*.92))}`, 3, "Tira metálica", "Carrocería"]
    );
  } else if (trailerType === "open" || trailerType === "low" || trailerType === "extendable") {
    bodyPieces.push(
      ["Vigas longitudinales de plataforma", `${cm(t*2)} × ${cm(t*2)} × ${cm(boxLen)}`, 2, "Perfil / listón", "Carrocería"],
      [trailerType === "low" ? "Rampas traseras" : "Travesaños de plataforma", `${cm(W*.72)} × ${cm(t*1.5)} × ${cm(t*2)}`, trailerType === "low" ? 2 : 8, "Perfil metálico / madera", "Carrocería"]
    );
    if (trailerType === "extendable") {
      bodyPieces.push(["Vigas extensibles", `${cm(t*2)} × ${cm(t*2)} × ${cm(boxLen*1.04)}`, 2, "Perfil metálico", "Carrocería"]);
    }
  } else {
    const sideHeight = boxH * (trailerType === "livestock" ? .68 : trailerType === "tipper" ? .88 : .75);
    bodyPieces.push(
      [`Laterales de ${trailer.name.toLowerCase()}`, `${cm(t)} × ${cm(sideHeight)} × ${cm(boxLen)}`, 2, trailerType === "curtainsider" ? "Lona y perfiles" : "Madera / panel", "Carrocería"],
      ["Frente y puertas traseras", `${cm(W*.92)} × ${cm(sideHeight)} × ${cm(t)}`, 2, "Panel / metal", "Carrocería"]
    );
    if (trailerType !== "livestock" && trailerType !== "tipper") {
      bodyPieces.push(["Techo del remolque", `${cm(W*.92)} × ${cm(t)} × ${cm(boxLen)}`, 1, "Panel / metal", "Carrocería"]);
    }
    if (trailerType === "refrigerated") {
      bodyPieces.push(["Unidad de refrigeración", `${cm(W*.42)} × ${cm(sideHeight*.44)} × ${cm(t*2)}`, 1, "Plástico / metal", "Carrocería"]);
    }
    if (trailerType === "container") {
      bodyPieces.push(["Refuerzos del contenedor", `${cm(t)} × ${cm(sideHeight*.94)} × ${cm(t)}`, 36, "Perfil metálico", "Carrocería"]);
    }
    if (trailerType === "livestock") {
      bodyPieces.push(["Barras de ventilación", `${cm(t*1.5)} × ${cm(t*1.5)} × ${cm(boxLen)}`, 8, "Perfil metálico", "Carrocería"]);
    }
    if (trailerType === "logging") {
      bodyPieces.push(["Troncos", `Ø ${cm(W*.14)} × ${cm(boxLen*.9)}`, 5, "Madera", "Carrocería"]);
    }
    if (trailerType === "extendable") {
      bodyPieces.push(["Vigas extensibles", `${cm(t*2)} × ${cm(t*2)} × ${cm(boxLen*1.04)}`, 2, "Perfil metálico", "Carrocería"]);
    }
    if (trailerType === "tipper") {
      bodyPieces.push(["Cilindros hidráulicos", `Ø ${cm(t)} × ${cm(boxH*.55)}`, 2, "Metal", "Carrocería"]);
    }
  }

  const accessoryPiece = trailerType === "tanker" || trailerType === "silo"
    ? ["Escalones laterales", `${cm(W*.08)} × ${cm(t*1.5)} × ${cm(cabLen*.55)}`, 2, "Madera / metal", "Tanques y accesorios"]
    : ["Tanques laterales", `Ø 2,4 cm × ${cm(L*.13)}`, 2, "Tubo / madera", "Tanques y accesorios"];

  const pieces = [
    ["Largueros del chasis", `${cm(L*.94)} × ${cm(W*.10)} × ${cm(t)}`, 2, "Listón de madera", "Chasis"],
    ["Travesaños del chasis", `${cm(W*.82)} × ${cm(t*1.1)} × ${cm(W*.07)}`, 4, "Listón de madera", "Chasis"],
    ["Piso de cabina", `${cm(W*.92)} × ${cm(t)} × ${cm(cabLen*.95)}`, 1, "Contrachapado", "Cabina"],
    ["Frente de cabina", `${cm(W*.92)} × ${cm(cabH*.63)} × ${cm(t)}`, 1, "Madera delgada", "Cabina"],
    ...(truckType === "north-american" ? [
      ["Cofre largo", `${cm(W*.78)} × ${cm(cabH*.24)} × ${cm(cabLen*.34)}`, 1, "Madera / plástico", "Cabina"],
      ["Dormitorio", `${cm(W*.78)} × ${cm(cabH*.43)} × ${cm(cabLen*.20)}`, 1, "Madera / plástico", "Cabina"]
    ] : []),
    ["Techo de cabina", `${cm(W*.92)} × ${cm(t)} × ${cm(cabLen*.94)}`, 1, "Madera delgada", "Cabina"],
    ["Pared trasera de cabina", `${cm(W*.92)} × ${cm(cabH*.70)} × ${cm(t)}`, 1, "Madera delgada", "Cabina"],
    ["Laterales de cabina", `${cm(t)} × ${cm(cabH*.70)} × ${cm(cabLen*.90)}`, 2, "Madera delgada", "Cabina"],
    ["Parabrisas", `${cm(W*.72)} × ${cm(cabH*.24)} × 0,25 cm`, 1, "Acetato transparente", "Cabina"],
    ["Ventanas laterales", `0,25 × ${cm(cabH*.26)} × ${cm(cabLen*.42)}`, 2, "Acetato transparente", "Cabina"],
    ["Tablero", `${cm(W*.78)} × ${cm(cabH*.055)} × ${cm(cabLen*.10)}`, 1, "Madera / plástico", "Cabina"],
    ["Asientos", `${cm(W*.25)} × ${cm(cabH*.24)} × ${cm(cabLen*.19)}`, 2, "Madera / espuma", "Cabina"],
    ...bodyPieces,
    ["Ruedas", `Ø ${cm(wheelR*2)} × ${cm(W*.12)}`, 22, "Goma / impresión 3D", "Ruedas"],
    ["Rines", `Ø ${cm(wheelR*1.04)} × ${cm(W*.125)}`, 22, "Plástico / impresión 3D", "Ruedas"],
    ["Ejes", `Ø 0,35 cm × ${cm(W*1.05)}`, 6, "Varilla metálica", "Ejes"],
    ["Parachoques", `${cm(W*1.02)} × 1,6 × 1,2 cm`, 2, "Madera / plástico", "Parachoques"],
    ["Faros delanteros", `${cm(W*.12)} × 1,2 × 0,35 cm`, 2, "Plástico translúcido", "Luces y espejos"],
    ["Espejos retrovisores", `0,7 × 1,8 × 0,8 cm`, 2, "Plástico / alambre", "Luces y espejos"],
    accessoryPiece
  ];

  pieces.forEach(([name, measure, qty, material, key]) => {
    const tr = document.createElement("tr");

    tr.dataset.key = key;

    tr.innerHTML = `
      <td>${name}</td>
      <td>${measure}</td>
      <td>${qty}</td>
      <td>${material}</td>
    `;

    tr.addEventListener("click", () => selectPart(key));

    body.appendChild(tr);
  });
}

// INFORMACIÓN DE PIEZAS

function showPartInfo(key) {
  const panel = $("partInfo");

  if (!key) {
    panel.innerHTML = `
      <div class="part-chip">DETALLE DE PIEZA</div>
      <div class="part-symbol">▧</div>
      <h3>Selecciona un componente</h3>
      <p>Haz clic en una pieza de la tabla o directamente sobre el camión 3D para consultar su descripción y medidas.</p>
    `;
    return;
  }

  const p = partDefinitions.find(x => x.key === key);

  if (!p) return;

  panel.innerHTML = `
    <div class="part-chip">DETALLE DE PIEZA</div>
    <div class="part-symbol">▧</div>
    <h3>${p.key}</h3>
    <p>${p.description}</p>

    <div class="measure-line">
      <span>Medida</span>
      <b>${p.measurement}</b>
    </div>

    <div class="measure-line">
      <span>Cantidad</span>
      <b>${p.quantity}</b>
    </div>

    <div class="measure-line">
      <span>Material sugerido</span>
      <b>${p.material}</b>
    </div>
  `;
}

function selectPart(key) {
  selectedPart = key;

  $("selectedPartLabel").textContent =
    "Pieza seleccionada: " + key;

  document.querySelectorAll("#partsTable tr")
    .forEach(tr => {
      tr.classList.toggle(
        "selected",
        tr.dataset.key === key
      );
    });

  showPartInfo(key);

  const group = partGroups.get(key);

  if (group) {
    controls.target.copy(group.position);
  }
}

function renderManualParts() {
  const list = $("manualParts");
  list.replaceChildren();

  partDefinitions.forEach(part => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const button = document.createElement("button");
    const isRemoved = removedParts.has(part.key);

    row.className = isRemoved ? "manual-part removed" : "manual-part";
    label.textContent = part.name;
    button.type = "button";
    button.textContent = isRemoved ? "Instalar" : "Retirar";
    button.setAttribute("aria-pressed", String(isRemoved));
    button.addEventListener("click", () => toggleManualPart(part.key));

    row.append(label, button);
    list.appendChild(row);
  });
}

function updateAssemblyStatus() {
  const status = $("assemblyStatus");
  const count = removedParts.size;

  status.textContent = exploded
    ? "PIEZAS SEPARADAS"
    : count
      ? `DESPIECE MANUAL: ${count} CONJUNTO${count === 1 ? "" : "S"} RETIRADO${count === 1 ? "" : "S"}`
      : "MODELO ENSAMBLADO";

  $("assembleBtn").classList.toggle("active", !exploded);
  $("explodeBtn").classList.toggle("active", exploded);
}

function toggleManualPart(key) {
  if (removedParts.has(key)) {
    removedParts.delete(key);
  } else {
    removedParts.add(key);
  }

  renderManualParts();
  updateAssemblyStatus();
  selectPart(key);
}

// CÁLCULO DE MEDIDAS

function calculate() {
  const scale = Number($("scale").value);

  const l = Number($("realLength").value);
  const w = Number($("realWidth").value);
  const h = Number($("realHeight").value);
  const wood = Number($("woodThickness").value);

  if (
    ![scale, l, w, h, wood].every(Number.isFinite) ||
    scale <= 0 ||
    l <= 0 ||
    w <= 0 ||
    h <= 0 ||
    wood <= 0 ||
    wood > 30
  ) {
    alert("Ingresa medidas mayores que cero y un grosor de madera de hasta 30 mm.");
    return;
  }

  const L = l / scale;
  const W = w / scale;
  const H = h / scale;

  $("overallLength").innerHTML =
    `${fmt(L)} <small>cm largo</small>`;

  $("overallWidth").textContent = fmt(W) + " cm";
  $("overallHeight").textContent = fmt(H) + " cm";
  $("overallScale").textContent = "1:" + scale;

  $("stripL").textContent = fmt(L) + " cm";
  $("stripW").textContent = fmt(W) + " cm";
  $("stripH").textContent = fmt(H) + " cm";
  $("stripWood").textContent = wood + " mm";

  buildTruck();
}

// BOTONES

function setExploded(value) {
  exploded = value;

  updateAssemblyStatus();
}

$("explodeBtn").addEventListener(
  "click",
  () => setExploded(true)
);

$("assembleBtn").addEventListener(
  "click",
  () => setExploded(false)
);

$("reassembleAllBtn").addEventListener("click", () => {
  exploded = false;
  removedParts.clear();
  renderManualParts();
  updateAssemblyStatus();
});

$("wheelAnimationBtn").addEventListener("click", event => {
  wheelAnimation = !wheelAnimation;
  event.currentTarget.classList.toggle("active", wheelAnimation);
  event.currentTarget.setAttribute("aria-pressed", String(wheelAnimation));
  event.currentTarget.textContent = wheelAnimation
    ? showroomMode ? "Pausar modelos" : "Pausar marcha"
    : showroomMode ? "Rotar modelos" : "Animar marcha";
});

$("lightsBtn").addEventListener("click", () => {
  setVehicleLights(!vehicleLightsEnabled);
});

$("showroomBtn").addEventListener("click", () => {
  setShowroomMode(!showroomMode);
});

$("calculateBtn").addEventListener(
  "click",
  calculate
);

$("truckType").addEventListener("change", () => {
  applyReferenceDimensions();
  calculate();
});

$("trailerType").addEventListener("change", () => {
  applyReferenceDimensions();
  calculate();
});

$("scale").addEventListener("change", calculate);

$("printBtn").addEventListener(
  "click",
  () => window.print()
);

$("resetViewBtn").addEventListener("click", () => {
  if (showroomMode) {
    frameShowroom();
    return;
  }

  const len =
    Number($("realLength").value) /
    Number($("scale").value) / 10;
  const height =
    Number($("realHeight").value) /
    Number($("scale").value) / 10;

  camera.position.set(
    len * .75,
    height * .9,
    len
  );

  controls.target.set(0, height * .25, 0);
  controls.update();
});

// SELECCIONAR PIEZAS EN EL MODELO 3D

view.addEventListener("click", event => {
  if (!renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();

  const mouse = new THREE.Vector2(
    (event.clientX - rect.left) / rect.width * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();

  raycaster.setFromCamera(mouse, camera);

  if (showroomMode) {
    const hits = raycaster.intersectObjects(showroomRoot.children, true);
    let object = hits[0]?.object;

    while (object && !object.userData.catalogTruckId) {
      object = object.parent;
    }

    if (object?.userData.catalogTruckId) {
      $("truckType").value = object.userData.catalogTruckId;
      $("trailerType").value = object.userData.catalogTrailerId;
      applyReferenceDimensions();
      setShowroomMode(false);
    }
    return;
  }

  if (!truckRoot) return;
  const hits = raycaster.intersectObjects(
    truckRoot.children,
    true
  );

  if (hits.length) {
    let obj = hits[0].object;

    while (obj && !obj.userData.partKey) {
      obj = obj.parent;
    }

    if (obj?.userData.partKey) {
      selectPart(obj.userData.partKey);
    }
  }
});

view.addEventListener("dblclick", event => {
  if (!renderer || showroomMode || !truckRoot) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    (event.clientX - rect.left) / rect.width * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const hit = raycaster.intersectObjects(truckRoot.children, true)[0];
  let object = hit?.object;

  while (object && !object.userData.partKey) {
    object = object.parent;
  }

  if (object?.userData.partKey) {
    toggleManualPart(object.userData.partKey);
  }
});

// SELECCIONAR PASOS DE CONSTRUCCIÓN

document.querySelectorAll(".step").forEach(step => {
  step.addEventListener("click", () => {
    document.querySelectorAll(".step")
      .forEach(s => s.classList.remove("active"));

    step.classList.add("active");
  });
});

// INICIAR PROGRAMA

populateModelSelectors();
applyReferenceDimensions();
init3D();
calculate();
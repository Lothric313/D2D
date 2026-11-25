import {
  AmbientLight, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight,
  ExtrudeGeometry, Group, InstancedMesh, LatheGeometry, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, OrthographicCamera, PlaneGeometry, PMREMGenerator,
  Scene, Shape, SRGBColorSpace, TextureLoader, TorusGeometry, Vector2, Vector3,
  WebGLRenderer,
} from 'three';

const fullTurn = 2 * Math.PI;
const camera = new OrthographicCamera(-1.72, 1.72, 1.72, -1.72, .1, 30);
camera.position.z = 8;

function studioReflections(renderer) {
  const stage = new Scene();
  stage.background = new Color(0x171417);
  const panels = [
    [-3, 3, 4, 3.4, 5, 0xfff6f4, 3.5],
    [3, 1.5, 2, 1.1, 4.5, 0xffecee, 2.3],
    [1, 3, -3, 4, 1.6, 0xffe6e5, 2.6],
    [-3, -2, -1, 2, 3, 0xf62339, 1.8],
  ];

  for (const [x, y, z, width, height, color, power] of panels) {
    const panel = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ color: new Color(color).multiplyScalar(power) }),
    );
    panel.position.set(x, y, z);
    panel.lookAt(new Vector3());
    stage.add(panel);
  }

  const baker = new PMREMGenerator(renderer);
  const reflections = baker.fromScene(stage, .07, .1, 30);
  for (const panel of stage.children) {
    panel.geometry.dispose();
    panel.material.dispose();
  }
  baker.dispose();
  return reflections.texture;
}

function coneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const grain = ((x * 73 + y * 151 + (x * y) % 127) % 37) - 18;
      const weave = Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) * 12;
      const value = 112 + grain + weave + Math.sin(y * Math.PI / 3) * 12;
      const index = (y * canvas.width + x) * 4;
      pixels.data.set([value, value, value, 255], index);
    }
  }

  context.putImageData(pixels, 0, 0);
  return new CanvasTexture(canvas);
}

function makeDriver(onChange) {
  const model = new Group();
  const shell = new MeshStandardMaterial({ color: 0x303034, metalness: .68, roughness: .33 });
  const blackMetal = new MeshStandardMaterial({ color: 0x1d1c1e, metalness: .48, roughness: .45 });
  const redMetal = new MeshStandardMaterial({ color: 0x991722, metalness: .54, roughness: .32 });
  const rubber = new MeshStandardMaterial({ color: 0x1e1c1d, metalness: .06, roughness: .49 });
  const ferrite = new MeshStandardMaterial({ color: 0x1e1d1f, roughness: .84 });
  const steel = new MeshStandardMaterial({ color: 0x646367, metalness: .72, roughness: .33 });
  const cone = new MeshStandardMaterial({
    color: 0x272527, metalness: .22, roughness: .53, bumpMap: coneTexture(), bumpScale: .017,
  });

  function add(geometry, material, z = 0) {
    const mesh = new Mesh(geometry, material);
    mesh.position.z = z;
    model.add(mesh);
    return mesh;
  }

  function profile(points, material) {
    const geometry = new LatheGeometry(points.map(([radius, z]) => new Vector2(radius, z)), 64);
    geometry.rotateX(Math.PI / 2);
    return add(geometry, material);
  }

  function ring(radius, thickness, material, z, depth = 1) {
    const mesh = add(new TorusGeometry(radius, thickness, 10, 64), material, z);
    mesh.scale.z = depth;
    return mesh;
  }

  function cylinder(radius, depth, material, z) {
    const mesh = add(new CylinderGeometry(radius, radius, depth, 48), material, z);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  cylinder(.60, .25, ferrite, -.68);
  cylinder(.64, .066, blackMetal, -.81);
  cylinder(.631, .035, redMetal, -.535);
  cylinder(.64, .061, shell, -.488);
  ring(.58, .018, steel, -.835, .55);
  ring(.30, .025, blackMetal, -.855);
  profile([[.28, -.51], [.46, -.44], [.66, -.20], [.83, .03], [.98, .28], [1.07, .45]], blackMetal);
  profile([[1.10, .26], [1.215, .32], [1.268, .376], [1.269, .453], [1.235, .494], [1.178, .501], [1.126, .474]], shell);
  ring(1.227, .019, steel, .493, .45);
  ring(1.164, .023, redMetal, .480, .70);
  ring(1.136, .014, blackMetal, .478);
  ring(1.036, .091, rubber, .449, .85);

  const membrane = [[.96, .453], [.935, .441]];
  for (let index = 0; index <= 20; index++) {
    const progress = index / 20;
    membrane.push([.923 - progress * .66, .433 - progress * .26 + Math.sin(index * 1.37) * .0018]);
  }
  membrane.push([.22, .168]);
  profile(membrane, cone);
  profile([[.325, .165], [.313, .202], [.284, .258], [.232, .303], [.168, .337], [.09, .359], [.001, .368]], cone);
  ring(.326, .011, rubber, .183);

  const web = new Shape();
  web.moveTo(.49, -.50);
  web.lineTo(.62, -.50);
  web.lineTo(.88, -.23);
  web.lineTo(1.18, .28);
  web.lineTo(1.18, .365);
  web.lineTo(1.057, .365);
  web.lineTo(.86, .083);
  web.lineTo(.68, -.24);
  web.closePath();

  const webGeometry = new ExtrudeGeometry(web, { depth: .115, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .027, bevelThickness: .027 });
  webGeometry.translate(0, 0, -.0575);
  webGeometry.rotateX(Math.PI / 2);

  const basket = new InstancedMesh(webGeometry, shell, 8);
  const bolts = new InstancedMesh(new CylinderGeometry(.036, .044, .014, 10).rotateX(Math.PI / 2), steel, 8);
  const slots = new InstancedMesh(new BoxGeometry(.035, .009, .002), blackMetal, 8);
  const transform = new Object3D();

  for (let index = 0; index < 8; index++) {
    const angle = (index + .5) / 8 * fullTurn;
    transform.position.set(0, 0, 0);
    transform.rotation.z = angle;
    transform.updateMatrix();
    basket.setMatrixAt(index, transform.matrix);
    transform.position.set(Math.cos(angle) * 1.197, Math.sin(angle) * 1.197, .499);
    transform.updateMatrix();
    bolts.setMatrixAt(index, transform.matrix);
    transform.position.z = .507;
    transform.updateMatrix();
    slots.setMatrixAt(index, transform.matrix);
  }

  model.add(basket, bolts, slots);

  const terminal = add(new BoxGeometry(.16, .32, .17), blackMetal, -.25);
  terminal.position.set(.88, -.20, -.25);
  for (const [y, material] of [[-.27, redMetal], [-.13, steel]]) {
    const plug = add(new CylinderGeometry(.036, .036, .082, 12), material, -.25);
    plug.rotation.z = Math.PI / 2;
    plug.position.set(.979, y, -.25);
  }

  new TextureLoader().load('./assets/d2d.png', (logo) => {
    logo.colorSpace = SRGBColorSpace;
    const mark = add(new PlaneGeometry(.29, .1015), new MeshBasicMaterial({
      map: logo, transparent: true, opacity: .76, depthWrite: false,
    }), .374);
    mark.renderOrder = 1;
    onChange();
  });

  return model;
}

export function createSpeaker(canvas, onChange) {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!context) return null;

  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new Scene();
  scene.environment = studioReflections(renderer);
  scene.environmentIntensity = .88;
  scene.add(new AmbientLight(0xfff8f7, .46));
  for (const [color, intensity, x, y, z] of [
    [0xfff5f3, 2.6, -3, 4, 6],
    [0xffe1e4, 1.75, 5, 1, -1],
    [0xfa3749, 1.25, -3, -3, 1],
  ]) {
    const light = new DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }
  const model = makeDriver(onChange);
  scene.add(model);

  let size = 0;
  return (width, pitch, yaw, roll, offsetX) => {
    const roundedWidth = Math.min(Math.round(width), 800);
    if (roundedWidth !== size) {
      size = roundedWidth;
      renderer.setSize(size, size, false);
    }
    model.position.x = offsetX;
    model.rotation.set(pitch, yaw, roll, 'ZYX');
    renderer.render(scene, camera);
  };
}

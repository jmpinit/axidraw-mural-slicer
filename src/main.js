const THREE = require('three');
const svg = require('./svg');

let renderer;
let camera;
let scene;

let uiController;

let mouseDown = false;

// STATE

const brushStrokes = [];

// END STATE

const raycaster = new THREE.Raycaster();

class UIController {
  constructor() {
    this.domElement = svg.createSVGElement('svg');
    this.domElement.setAttribute('id', 'uiview');

    this.drawingModeBox = svg.createSVGElement('rect', {
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      fill: 'yellow',
    });

    this.domElement.appendChild(this.drawingModeBox);
  }

  setMode(mode) {
    switch (mode) {
      case 'drawing':
        this.drawingModeBox.setAttribute('fill', 'green');
        break;
      case 'pathing':
        this.drawingModeBox.setAttribute('fill', 'white');
        break;
      default:
        throw new Error(`Unknown mode "${mode}"`);
    }
  }
}

const canvas3d = (() => {
  const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
})();

let lastPoint;

function onDocumentMouseMove(event) {
  if (!mouseDown) {
    return;
  }

  const mouse = new THREE.Vector2(
    ((event.clientX / window.innerWidth) * 2) - 1,
    -((event.clientY / window.innerHeight) * 2) + 1,
  );

  raycaster.setFromCamera(mouse.clone(), camera);
  const intersected = raycaster.intersectObject(canvas3d);

  if (intersected.length === 0) {
    // Nothing to draw on
    return;
  }

  const canvasIntersection = intersected[0];

  if (canvasIntersection.length === 0) {
    return;
  }

  const sectPoint = new THREE.Vector2(
    canvasIntersection.point.x,
    canvasIntersection.point.y,
  );

  if (lastPoint === undefined) {
    lastPoint = sectPoint;
    return;
  }

  if (sectPoint.distanceTo(lastPoint) < 10) {
    // Too close for a new point
    return;
  }

  const material = new THREE.LineBasicMaterial({
    color: 0x0000ff,
  });

  const geometry = new THREE.Geometry();
  geometry.vertices.push(
    new THREE.Vector3(lastPoint.x, lastPoint.y, 10),
    new THREE.Vector3(sectPoint.x, sectPoint.y, 10),
  );

  const line = new THREE.Line(geometry, material);
  scene.add(line);
  brushStrokes.push(line);

  lastPoint.copy(sectPoint);
}

function undo() {
  const lastStroke = brushStrokes.pop();
  scene.remove(lastStroke);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}

function main() {
  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('mousemove', onDocumentMouseMove, false);
  document.addEventListener('mousedown', () => {
    uiController.setMode('drawing');
    mouseDown = true;
  }, false);
  document.addEventListener('mouseup', () => {
    uiController.setMode('pathing');
    lastPoint = undefined;
    mouseDown = false;
  }, false);

  document.addEventListener('keypress', (event) => {
    switch (event.key) {
      case 'u':
        undo();
        break;
    }
  });

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.setAttribute('id', 'threeview');
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  // Add geometry

  scene.add(canvas3d);

  camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    -window.innerHeight / 2,
    window.innerHeight / 2,
    -500, 1000,
  );

  camera.position.x = 0;
  camera.position.y = 0;
  camera.position.z = 100;

  render(scene, camera);

  // UI

  uiController = new UIController();
  uiController.domElement.setAttribute('id', 'uiview');
  document.body.append(uiController.domElement);
}

main();

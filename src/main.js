const THREE = require('three');
const Dropzone = require('dropzone');
const svg = require('./svg');

let renderer;
let camera;
let scene;

let uiController;

let mouseDown = false;

// STATE

let brushStrokes = [];

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

function makeStroke(x1, y1, x2, y2) {
  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });

  const geometry = new THREE.Geometry();
  geometry.vertices.push(
    new THREE.Vector3(x1, y1, 10),
    new THREE.Vector3(x2, y2, 10),
  );

  return new THREE.Line(geometry, material);
}

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

  const stroke = makeStroke(lastPoint.x, lastPoint.y, sectPoint.x, sectPoint.y);
  scene.add(stroke);
  brushStrokes.push(stroke);

  lastPoint.copy(sectPoint);
}

function undo() {
  const lastStroke = brushStrokes.pop();
  scene.remove(lastStroke);
}

function save() {
  console.log(brushStrokes[0]);

  const strokeObject = JSON.stringify(brushStrokes.map(stroke => ({
    x1: stroke.geometry.vertices[0].x,
    y1: stroke.geometry.vertices[0].y,
    x2: stroke.geometry.vertices[1].x,
    y2: stroke.geometry.vertices[1].y,
  })));

  const saveName = prompt('Save file name:', 'painting');

  if (saveName === null) {
    // They hit cancel, so abort the save
    return;
  }

  const filename = `${saveName}.json`;

  const blob = new window.Blob([strokeObject], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  document.body.appendChild(anchor);
  anchor.style = 'display: none';
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.URL.revokeObjectURL(url);
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

function fileToString(file) {
  return new Promise((fulfill, reject) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      if (evt.target.readyState !== 2) {
        return;
      }

      if (evt.target.error) {
        reject(evt.target.error);
      }

      fulfill(evt.target.result);
    };

    reader.readAsText(file);
  });
}

const mediaDropzone = new Dropzone(document.body, {
  previewsContainer: '.dropzone-previews',
  url: '/file-upload',
  clickable: false,
  init() {
    this.on('addedfile', (file) => {
      mediaDropzone.removeFile(file);

      document.body.style.webkitAnimationPlayState = 'running';

      if (file.type !== 'application/json') {
        console.log(file);
        alert('Unknown file format');
      }

      fileToString(file).then((json) => {
        try {
          const loadedBrushStrokes = JSON.parse(json);

          brushStrokes.forEach(stroke => scene.remove(stroke));
          brushStrokes = loadedBrushStrokes.map(({ x1, y1, x2, y2 }) =>
            makeStroke(x1, y1, x2, y2));
          brushStrokes.forEach(stroke => scene.add(stroke));
        } catch (e) {
          console.error(e, json);
          alert(`"HLEEAAHHHurkurkBLLEAAHH! HuuRRGblh..."\n\n*splat*\n\n${e.message}`);
        }
      });
    });
  },
});

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
      case 's':
        save();
        break;
      default:
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

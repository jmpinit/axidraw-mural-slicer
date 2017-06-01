const THREE = require('three');

let renderer;
let camera;
let scene;

let mouseDown = false;

const raycaster = new THREE.Raycaster();

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
  console.log('added line', geometry);

  lastPoint.copy(sectPoint);
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
  document.addEventListener('mousedown', () => { mouseDown = true; }, false);
  document.addEventListener('mouseup', () => {
    lastPoint = undefined;
    mouseDown = false;
  }, false);

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
}

main();

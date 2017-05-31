const THREE = require('three');
const _ = require('lodash');
const svgFilter = require('svg-to-lines');

const axiDraw = {
  convertionFactor: 2.5,
  bounds: {
    x: 215,
    y: 215,
  },
  originOffset: {
    x: 15,
    y: 0,
    z: 100,
  },
};

const highlightedMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
let line;

const lineCanvas = document.createElement('canvas');
lineCanvas.width = 512;
lineCanvas.height = 512;
document.body.appendChild(lineCanvas);

var scene = new THREE.Scene();
//var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
//const camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, -500, 1000);
const camScale = 2;
const camera = new THREE.OrthographicCamera(-camScale * window.innerWidth, camScale * window.innerWidth, camScale * window.innerHeight, -camScale * window.innerHeight, -500, 1000);
camera.rotateX(Math.PI/2);
camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 10;

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.domElement.setAttribute('id', 'threeview');
document.body.appendChild( renderer.domElement );

const sliceSize = Math.min(axiDraw.bounds.x, axiDraw.bounds.y);

var geometry = new THREE.BoxGeometry(sliceSize, sliceSize, sliceSize);
geometry.translate(sliceSize / 2 + axiDraw.originOffset.x, 0, sliceSize / 2 + axiDraw.originOffset.z);

var material = new THREE.MeshBasicMaterial( {
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.2,
  color: 0xffffff } );
var sliceBoxObject = new THREE.Mesh( geometry, material );
scene.add(sliceBoxObject);

(() => {
  const geometry = new THREE.BoxGeometry(10, 10, 10);
  var material = new THREE.MeshBasicMaterial( {
    color: 0xffffff } );
  const originMarker = new THREE.Mesh(geometry, material);
  sliceBoxObject.add(originMarker);
})();

camera.position.z = 5;

var render = function () {
  requestAnimationFrame( render );

  renderer.render(scene, camera);
};

render();

function get(url) {
  return new Promise((fulfill, reject) => {
    const req = new XMLHttpRequest();

    req.onreadystatechange = () => {
      if (req.readyState == XMLHttpRequest.DONE) {
        if (req.status == 200) {
          fulfill(req.responseText);
        } else {
          reject(new Error(`Request status ${req.status}`));
        }
      }
    };

    req.open('GET', url, true);
    req.send();
  });
}

const sliceBox = (() => {
  const hs = sliceSize / 2;

  // top
  const p1 = new THREE.Plane();
  p1.setFromCoplanarPoints(
    new THREE.Vector3(-hs, -hs, -hs),
    new THREE.Vector3(hs, -hs, -hs),
    new THREE.Vector3(-hs, hs, -hs),
  );

  // left
  const p2 = new THREE.Plane();
  p2.setFromCoplanarPoints(
    new THREE.Vector3(-hs, -hs, hs),
    new THREE.Vector3(-hs, -hs, -hs),
    new THREE.Vector3(-hs, hs, -hs),
  );

  // right
  const p3 = new THREE.Plane();
  p3.setFromCoplanarPoints(
    new THREE.Vector3(hs, -hs, hs),
    new THREE.Vector3(hs, -hs, -hs),
    new THREE.Vector3(hs, hs, -hs),
  );

  // bottom
  const p4 = new THREE.Plane();
  p4.setFromCoplanarPoints(
    new THREE.Vector3(-hs, hs, hs),
    new THREE.Vector3(-hs, -hs, hs),
    new THREE.Vector3(hs, -hs, hs),
  );

  // back
  const p5 = new THREE.Plane();
  p5.setFromCoplanarPoints(
    new THREE.Vector3(-hs, -hs, hs),
    new THREE.Vector3(-hs, -hs, -hs),
    new THREE.Vector3(hs, -hs, -hs),
  );

  // front
  const p6 = new THREE.Plane();
  p6.setFromCoplanarPoints(
    new THREE.Vector3(-hs, hs, hs),
    new THREE.Vector3(-hs, hs, -hs),
    new THREE.Vector3(hs, hs, -hs),
  );

  return new THREE.Frustum(p1, p2, p3, p4, p5, p6);
})();

const raycaster = new THREE.Raycaster();
const up = new THREE.Vector3(0, 1, 0);
const down = new THREE.Vector3(0, -1, 0);
const left = new THREE.Vector3(-1, 0, 0);
const right = new THREE.Vector3(1, 0, 0);
const back = new THREE.Vector3(0, -1, 0);
const front = new THREE.Vector3(0, 1, 0);

function containsPoint(object, point) {
  raycaster.set(point, up);
  const hitsUp = raycaster.intersectObject(object).length > 0;
  raycaster.set(point, down);
  const hitsDown = raycaster.intersectObject(object).length > 0;
  raycaster.set(point, left);
  const hitsLeft = raycaster.intersectObject(object).length > 0;
  raycaster.set(point, right);
  const hitsRight = raycaster.intersectObject(object).length > 0;
  raycaster.set(point, back);
  const hitsBack = raycaster.intersectObject(object).length > 0;
  raycaster.set(point, front);
  const hitsFront = raycaster.intersectObject(object).length > 0;

  return hitsUp && hitsDown && hitsLeft && hitsRight && hitsBack && hitsFront;
}

function updateLines() {
  const slicedPts = line.geometry.vertices.filter(vertex =>
    containsPoint(sliceBoxObject, vertex));

  const ctx = lineCanvas.getContext('2d');
  ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
  ctx.fillStyle = '#000';
  slicedPts.forEach(pt => ctx.fillRect(pt.x, -pt.z, 4, 4));

  // Make points relative to machine origin
  const offset = new THREE.Vector3(sliceSize / 2 + axiDraw.originOffset.x, 0, sliceSize / 2 + axiDraw.originOffset.z);

  const machinePoints = slicedPts
    .map(pt => new THREE.Vector3(pt.x, pt.y, pt.z))
    .map(pt => sliceBoxObject.worldToLocal(pt))
    .map(pt => pt.sub(offset))
    .map(pt => pt.applyAxisAngle(up, 3 * Math.PI / 2))
    .map(pt => pt.set(pt.x + sliceSize / 2, pt.y + sliceSize / 2, pt.z + sliceSize / 2))
    .map(pt => pt.set(sliceSize - pt.x, pt.y, pt.z))
    //.map(pt => pt.set(sliceSize - pt.x, sliceSize - pt.y, pt.z))
    /*.map(pt => pt.set(pt.x * axiDraw.convertionFactor,
      pt.y * axiDraw.convertionFactor,
      pt.z * axiDraw.convertionFactor));*/

  ctx.fillStyle = '#f00';
  machinePoints.forEach(pt => ctx.fillRect(pt.x, pt.z, 4, 4));

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(axiDraw.bounds.x, 0);
  ctx.lineTo(axiDraw.bounds.x, axiDraw.bounds.y);
  ctx.lineTo(0, axiDraw.bounds.y);
  ctx.lineTo(0, 0);
  ctx.stroke();

  return machinePoints;
}

get('/art/pcb.svg').then((svgText) => {
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = svgDocument.getElementsByTagName('svg')[0];

  const ox = 50;
  const oy = -1000;
  const s = 2;
  const lines = svgFilter.lines(svgEl)
    .map(({ x1, y1, x2, y2 }) => ({
      x1: x1 * s + ox,
      y1: y1 * s + oy,
      x2: x2 * s + ox,
      y2: y2 * s + oy,
    }));
  console.log(lines);

  console.log(svgDocument);

  const testC = document.createElement('canvas');
  testC.width = 800;
  testC.height = 512;

  const ctx = testC.getContext('2d');

  lines.forEach((line) => {
    ctx.fillRect(line.x1, line.y1, 4, 4);
    ctx.fillRect(line.x2, line.y2, 4, 4);
  });

  document.body.appendChild(testC);

  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });

  const geometry = new THREE.Geometry();

  const scale = 1;
  lines.forEach((line) => {
    geometry.vertices.push(new THREE.Vector3(line.x1 / scale, 0, -line.y1 / scale));
    geometry.vertices.push(new THREE.Vector3(line.x2 / scale, 0, -line.y2 / scale));
  });

  line = new THREE.Line(geometry, material);

  scene.add(line);

  updateLines();
});

// AxiDraw

const axiConn = new WebSocket('ws://localhost:8025/axidraw');

function sendCommand(cmd) {
  axiConn.send(JSON.stringify(cmd));
}

const sendPoints = _.debounce((points) => {
  console.log('sending points!');
  sendCommand({ clear: true });

  sendCommand({ penDown: false });
  sendCommand({ x: points[0].x * axiDraw.convertionFactor, y: points[0].y * axiDraw.convertionFactor });
  sendCommand({ penDown: true });
  points.slice(1).forEach(({ x, z: y }) => sendCommand({ x: x * axiDraw.convertionFactor, y: y * axiDraw.convertionFactor }));
  sendCommand({ penDown: false });
}, 1000);

// AR JUNK

const ws = new WebSocket('ws://192.168.1.162:4649/controller');
ws.onmessage = (msg) => {
  const controller = JSON.parse(msg.data);
  sliceBoxObject.position.x = controller.posZ * 1000; //+ axiDraw.originOffset.x
  sliceBoxObject.position.z = -controller.posX * 1000; //+ axiDraw.originOffset.z
  //sliceBoxObject.position.z = controller.posZ * 1000;

  sliceBoxObject.quaternion.x = controller.rotX;
  sliceBoxObject.quaternion.y = controller.rotY;
  sliceBoxObject.quaternion.z = controller.rotZ;
  sliceBoxObject.quaternion.w = controller.rotW;

  sliceBoxObject.rotateX(Math.PI / 2);

  const points = updateLines();

  if (controller.triggerPressed) {
    sendPoints(points);
  }
};

ws.onopen = () => setInterval(() => ws.send(''), 200);

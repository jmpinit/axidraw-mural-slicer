const THREE = require('three');
const Dropzone = require('dropzone');
const svg = require('./svg');
const imageUtil = require('./image');

let renderer;
let camera;
let scene;

let uiController;

let mouseDown = false;

// STATE

let brushStrokes = [];

// END STATE

const raycaster = new THREE.Raycaster();

function brightness(imageData, x, y) {
  const i = ((y * imageData.width) + x) * 4;
  const r = imageData.data[i];
  const g = imageData.data[i + 1];
  const b = imageData.data[i + 2];

  return (r + g + b) / 255 / 3;
}

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

    this.threshold = 0.5;
  }

  raiseThreshold() {
    this.threshold += 0.01;

    if (this.threshold > 1) {
      this.threshold = 1;
    }

    this.thresholdImage();
  }

  lowerThreshold() {
    this.threshold -= 0.01;

    if (this.threshold < 0) {
      this.threshold = 0;
    }

    this.thresholdImage();
  }

  makeImageBigger() {
    if (this.imageSurface === undefined) {
      throw new Error('No image');
    }

    this.imageSurface.scale.x *= 1.2;
    this.imageSurface.scale.y *= 1.2;
  }

  makeImageSmaller() {
    if (this.imageSurface === undefined) {
      throw new Error('No image');
    }

    this.imageSurface.scale.x *= 0.8;
    this.imageSurface.scale.y *= 0.8;
  }

  thresholdImage() {
    const ctx = this.originalImage.getContext('2d');
    const imageData = ctx.getImageData(0, 0, this.originalImage.width, this.originalImage.height);

    for (let sy = 0; sy < imageData.height; sy += 1) {
      for (let sx = 0; sx < imageData.width; sx += 1) {
        const nb = brightness(imageData, sx, sy) < this.threshold ? 0 : 255;
        const i = ((sy * imageData.width) + sx) * 4;

        imageData.data[i] = nb;
        imageData.data[i + 1] = nb;
        imageData.data[i + 2] = nb;
      }
    }

    this.image.getContext('2d').putImageData(imageData, 0, 0);
    this.texture.needsUpdate = true;
  }

  imageAsStrokes() {
    const aspectRatio = this.image.width / this.image.height;

    const scaleX = this.imageSurface.scale.x;
    const scaleY = this.imageSurface.scale.y;

    const smaller = document.createElement('canvas');
    smaller.width = 32 * aspectRatio * scaleX;
    smaller.height = 32 * scaleY;

    const ctx = smaller.getContext('2d');
    ctx.drawImage(this.image, 0, 0, smaller.width, smaller.height);

    this.image = smaller;

    const worldWidth = scaleX * 128 * aspectRatio;
    const worldHeight = scaleY * 128;

    const startX = this.imageSurface.position.x - (worldWidth / 2);
    const startY = this.imageSurface.position.y - (worldHeight / 2);

    const imageData = ctx.getImageData(0, 0, this.image.width, this.image.height);

    const strokes = [];

    let x;
    let y;

    const worldX = sx => startX + ((sx / imageData.width) * worldWidth);
    const worldY = sy => startY + ((1 - (sy / imageData.height)) * worldHeight);

    const addStroke = (nx, ny) => {
      strokes.push({
        x1: x,
        y1: y,
        x2: nx,
        y2: ny,
      });

      x = nx;
      y = ny;
    };

    let drawing = false;

    for (let sy = 0; sy < imageData.height; sy += 1) {
      for (let sx = 0; sx < imageData.width; sx += 1) {
        if (brightness(imageData, sx, sy) < this.threshold) {
          if (!drawing) {
            drawing = true;
            x = worldX(sx);
            y = worldY(sy);
          }
        } else if (drawing) {
          addStroke(worldX(sx), worldY(sy));
          drawing = false;
        }

        if (sx === imageData.width - 1 && drawing) {
          // Stop at the end of the image
          addStroke(worldX(sx), worldY(sy));
          drawing = false;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    this.texture.needsUpdate = true;

    return strokes;
  }

  setImage(image) {
    this.image = image;
    this.originalImage = imageUtil.copyCanvas(image);
    this.texture = new THREE.Texture(this.image);

    this.thresholdImage();

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
    });

    const aspectRatio = this.image.width / this.image.height;

    this.imageSurface = (() => {
      const geometry = new THREE.PlaneGeometry(128 * aspectRatio, 128);
      const plane = new THREE.Mesh(geometry, material);
      plane.x = 0;
      plane.y = 0;
      plane.z = 5;

      return plane;
    })();

    scene.add(this.imageSurface);
  }

  setMouse(mouse) {
    if (this.mode === 'image') {
      const camWidth = (camera.right - camera.left);
      const camHeight = (camera.bottom - camera.top);

      this.imageSurface.position.x = (camWidth * mouse.x) + camera.left;
      this.imageSurface.position.y = (camHeight * mouse.y) + camera.top;
    }
  }

  setMode(mode) {
    switch (mode) {
      case 'drawing':
        this.drawingModeBox.setAttribute('fill', 'green');
        break;
      case 'pathing':
        this.drawingModeBox.setAttribute('fill', 'white');
        break;
      case 'image':
        this.drawingModeBox.setAttribute('fill', 'red');
        break;
      default:
        throw new Error(`Unknown mode "${mode}"`);
    }

    this.mode = mode;
  }
}

const canvasSize = 700;
const canvas3d = (() => {
  const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
})();

const visibleBounds = (() => {
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });

  const boundSize = canvasSize / 2;

  const geometry = new THREE.Geometry();
  geometry.vertices.push(
    new THREE.Vector3(-boundSize, -boundSize, 15),
    new THREE.Vector3(boundSize, -boundSize, 15),
    new THREE.Vector3(boundSize, boundSize, 15),
    new THREE.Vector3(-boundSize, boundSize, 15),
    new THREE.Vector3(-boundSize, -boundSize, 15),
  );

  return new THREE.Line(geometry, material);
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
  const mouse = new THREE.Vector2(
    ((event.clientX / window.innerWidth) * 2) - 1,
    -((event.clientY / window.innerHeight) * 2) + 1,
  );

  if (uiController.mode === 'image') {
    uiController.setMouse(new THREE.Vector2(
      event.clientX / window.innerWidth,
      event.clientY / window.innerHeight,
    ));
  }

  if (!mouseDown) {
    return;
  }

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

function savePainting() {
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

function loadPainting(file) {
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
}

function fileToCanvas(file) {
  return new Promise((fulfill, reject) => {
    const newImage = new Image();
    newImage.src = URL.createObjectURL(file);

    newImage.onload = () => fulfill(imageUtil.putOnCanvas(newImage));
    newImage.onerror = err => reject(err);
  });
}

function loadImage(file) {
  fileToCanvas(file).then((canvas) => {
    uiController.setMode('image');
    uiController.setImage(canvas);
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

      if (file.type === 'image/jpeg') {
        loadImage(file);
      } else if (file.type === 'application/json') {
        loadPainting(file);
      } else {
        console.log(file);
        alert(`Unknown file format: "${file.type}"`);
      }
    });
  },
});

function main() {
  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('mousemove', onDocumentMouseMove, false);
  document.addEventListener('mousedown', () => {
    if (uiController.mode === 'image') {
      // We are leaving image mode so we must convert the image to strokes
      const imageStrokes = uiController.imageAsStrokes();
      imageStrokes.forEach((line) => {
        const stroke = makeStroke(line.x1, line.y1, line.x2, line.y2);
        brushStrokes.push(stroke);
        scene.add(stroke);
      });
      scene.remove(uiController.imageSurface);
    }

    uiController.setMode('drawing');
    mouseDown = true;
  }, false);
  document.addEventListener('mouseup', () => {
    uiController.setMode('pathing');
    lastPoint = undefined;
    mouseDown = false;
  }, false);

  document.addEventListener('keypress', (event) => {
    if (uiController.mode === 'image') {
      switch (event.key) {
        case '+':
          uiController.makeImageBigger();
          break;
        case '-':
          uiController.makeImageSmaller();
          break;
        case 'w':
          uiController.raiseThreshold();
          break;
        case 's':
          uiController.lowerThreshold();
          break;
        default:
          break;
      }
    } else {
      switch (event.key) {
        case 'u':
          undo();
          break;
        case 's':
          savePainting();
          break;
        default:
          break;
      }
    }
  });

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.setAttribute('id', 'threeview');
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  // Add geometry

  scene.add(canvas3d);
  scene.add(visibleBounds);

  camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    -window.innerHeight / 2,
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

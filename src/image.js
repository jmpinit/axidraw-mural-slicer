function putOnCanvas(imageThing) {
  const canvas = document.createElement('canvas');
  canvas.width = imageThing.width;
  canvas.height = imageThing.height;

  const ctx = canvas.getContext('2d');

  ctx.drawImage(imageThing, 0, 0);

  return canvas;
}

function copyCanvas(canvas) {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = canvas.width;
  newCanvas.height = canvas.height;
  newCanvas.getContext('2d').drawImage(canvas, 0, 0);
  return newCanvas;
}

module.exports = {
  putOnCanvas,
  copyCanvas,
};

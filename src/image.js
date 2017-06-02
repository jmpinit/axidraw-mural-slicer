function putOnCanvas(imageThing) {
  const canvas = document.createElement('canvas');
  canvas.width = imageThing.width;
  canvas.height = imageThing.height;

  const ctx = canvas.getContext('2d');

  ctx.drawImage(imageThing, 0, 0);

  return canvas;
}

module.exports = {
  putOnCanvas,
};

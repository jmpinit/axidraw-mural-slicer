function createSVGElement(tag, opts) {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', tag);

  if (tag === 'svg') {
    svgEl.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  Object.keys(opts || {}).forEach(attrName =>
    svgEl.setAttribute(attrName, opts[attrName]));

  return svgEl;
}

module.exports = {
  createSVGElement,
};

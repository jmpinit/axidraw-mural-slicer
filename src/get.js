function get(url) {
  return new Promise((fulfill, reject) => {
    const req = new XMLHttpRequest();

    req.onreadystatechange = () => {
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
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

module.exports = get;

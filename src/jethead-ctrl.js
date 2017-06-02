const get = require('./get');

class JetheadController {
  constructor(ws) {
    this.socket = ws;

    this.HIGHWATER = 5; // Grbl buffers 127 characters and 16 line motions
    this.expectedAcks = 0;
    this.commandQueue = [];

    this.socket.onmessage = (message) => {
      const msgObj = JSON.parse(message.data);

      if (msgObj.data) {
        const machineMessage = msgObj.data;

        console.log('machine -> us:', machineMessage);

        if (machineMessage.trim() === 'ok') {
          if (this.expectedAcks <= 0) {
            throw new Error('Received ack but nothing sent');
          }

          this.expectedAcks -= 1;

          while (this.expectedAcks < this.HIGHWATER && this.commandQueue.length > 0) {
            this.send(this.commandQueue.shift());
            this.expectedAcks += 1;
          }
        }
      }
    };

    this.socket.onopen = () =>
      ws.send(JSON.stringify({ method: 'open', params: [{ baudRate: 115200 }] }));
  }

  send(machineMessage) {
    console.log('us -> machine:', machineMessage);
    this.socket.send(JSON.stringify({
      method: 'write',
      params: [machineMessage],
    }));
  }

  sendGcode(code) {
    const message = `${code}\r`;

    if (this.commandQueue.length === 0 && this.expectedAcks < this.HIGHWATER) {
      this.send(message);
      this.expectedAcks += 1;
    } else {
      this.commandQueue.push(message);
    }
  }

  runScript(commands) {
    ['G90', 'G21', 'S1', 'F5000', 'M5'].forEach(cmd => this.sendGcode(cmd));

    commands.forEach((command) => {
      switch (command.type) {
        case 'move': {
          const { x, y } = command;
          this.sendGcode(`G1 X${x} Z${y}`);
          break;
        }
        case 'inkOn':
          this.sendGcode('M3');
          break;
        case 'inkOff':
          this.sendGcode('M5');
          break;
        default:
          throw new Error(`Unknown command type "${command.type}"`);
      }
    });

    this.sendGcode('M5');
    this.sendGcode('G1 X0 Z0');
  }
}

function connect() {
  return get('http://localhost:3210/').then((portsStr) => {
    let ports = {};

    try {
      ports = JSON.parse(portsStr);
    } catch (e) {
      throw new Error(e);
    }

    const likelyMachinePortNames = Object.keys(ports).filter(port =>
      port.startsWith('cu.usb'));

    if (likelyMachinePortNames.length === 0) {
      // FIXME
      alert('No machines connected?');
      console.log(ports);
      throw new Error('No machines found');
    } else if (likelyMachinePortNames.length > 1) {
      alert('More than one machine connected. Don\'t know which to use');
      throw new Error('Too many machines');
    }

    const portName = likelyMachinePortNames[0];
    const ws = new WebSocket(`ws://localhost:1311/${portName}`);

    return Promise.resolve(new JetheadController(ws));
  });
}

module.exports = {
  connect,
};

// ./lib/gpio.js

'use strict';

var fs           = require('fs');
var path         = require('path');
var sleep        = require('thread-sleep');
var util         = require('util');

var EventEmitter = require('events').EventEmitter;

var PATH         = '/sys/class/gpio';
var EXPORT       = '/sys/class/gpio/export';
var UNEXPORT     = '/sys/class/gpio/unexport';

const PIN_MAPPING_REF = {
    "7": 249,
    "11": 247,
    "12": 238,
    "13": 239,
    "15": 237,
    "16": 236,
    "18": 233,
    "19": 235,
    "21": 232,
    "22": 231,
    "23": 230,
    "24": 229,
    "26": 225,
    "29": 228,
    "31": 219,
    "32": 224,
    "33": 234,
    "35": 214,
    "36": 218
};

/// FileWatcher

function FileWatcher(filePath, options){
  this.filePath = filePath;
  this.options = options || { interval: 50 };
  this._watch();
}; // FileWatcher

util.inherits(FileWatcher, EventEmitter);

FileWatcher.prototype._timerId = null;
FileWatcher.prototype._previousValue = null;

FileWatcher.prototype.stop = function() {
  clearInterval(this._timerId);
};

FileWatcher.prototype._watch = function() {
  this._timerId = setInterval(function() {
    var value = fs.readFileSync(this.filePath, { encoding: 'utf-8' });
    if (this._previousValue !== null && this._previousValue !== value) {
      this.emit('change', value, this._previousValue);
    };
    this._previousValue = value;
  }.bind(this), this.options.interval);
};

/// helper functions

function pathExist(path) {
    try {
        fs.statSync(path);
    } catch (e) {
        return 0;
    }
    return 1;
}

function readPin(pin) {
    var pinPath = path.join(PATH, 'gpio' + PIN_MAPPING_REF[pin]);

    if (!pathExist(pinPath)) {
        throw new Error('pin' + pin + ' has not been set yet.');
    } else {
        return pinPath;
    }
}

function setPin(pin) {
  var pinPath = path.join(PATH, 'gpio' + PIN_MAPPING_REF[pin]);
  console.log('in setPin, pinPath=',pinPath);
  console.log('pin', pin);
  console.log('PIN_MAPPING_REF[pin]',PIN_MAPPING_REF[pin]);
  if (!pathExist(pinPath)) {
    try {
      let data = PIN_MAPPING_REF[pin].toString();
      fs.writeFileSync(EXPORT, data);
      sleep(100); // A dirty hack to wait udev rules triger. Otherwise odroid user does not have access to the pin
    } catch (err) {
      throw err;
    }; // try
  }; // if
  return pinPath;
}; // setPin

function changeOwner(file) {
    var uid = process.getuid();
    var gid = process.getgid();
    fs.chownSync(file, uid, gid);
    /*
    if (chown (file, uid, gid) != 0)
    {
        if (errno == ENOENT)	// Warn that it's not there
            fprintf (stderr, "%s: Warning: File not present: %s\n", cmd, file) ;
        else
        {
            fprintf (stderr, "%s: Unable to change ownership of %s: %s\n", cmd, file, strerror (errno)) ;
            exit (1) ;
        }
    }*/
}

// module exports

module.exports = new EventEmitter();

module.exports.setup = function (pin, direction) {
    var pinPath = setPin(pin);
    fs.writeFileSync(path.join(pinPath, 'direction'), direction);
    if (direction === this.DIRECTION.IN) {
        new FileWatcher(path.join(pinPath, 'value'))
            .on('change', function(value, previousValue) {
                this.emit('change', pin, value, previousValue);
            }.bind(this));
    }
    return pinPath;
};

module.exports.write = function (pin, value) {
    var pinPath = this.setup(pin, this.DIRECTION.OUT);
    console.log("[write] pinPath= " + pinPath);
    fs.writeFileSync(path.join(pinPath, 'value'), String(value));
};

module.exports.read = function (pin) {
    var pinPath = readPin(pin);
    return String.fromCharCode(fs.readFileSync(path.join(pinPath, 'value')).readUInt8(0));
};

module.exports.unset = function (pin) {
    readPin(pin);
    fs.writeFileSync(UNEXPORT, PIN_MAPPING_REF[pin]);
};

module.exports.PIN = {
    GPIO_0: "11",
    GPIO_1: "12",
    GPIO_2: "13",
    GPIO_3: "15",
    GPIO_4: "16",
    GPIO_5: "18",
    GPIO_6: "22",
    GPIO_7: "7",
    GPIO_10: "24",
    GPIO_11: "26",
    GPIO_12: "19",
    GPIO_13: "21",
    GPIO_14: "23",
    GPIO_21: "29",
    GPIO_22: "31",
    GPIO_23: "33",
    GPIO_24: "35",
    GPIO_26: "32",
    GPIO_27: "36"
};

module.exports.DIRECTION = {
    IN: 'in',
    OUT: 'out'
};

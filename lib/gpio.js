// ./lib/gpio.js

'use strict';

var _              = require('lodash');
var bodyParser     = require('body-parser');
var requestIp      = require('request-ip');
// new(), read(cb), write(value, cb), watch(cb), unwatch(cb), unwatchAll(), direction(), setDirection(d)
// unexport(), accessible()
var Gpio           = require('onoff').Gpio;

const PINS = [
  {name: 'GPIO2',  pin: 3,  secondary: 'SDA I2C'},
  {name: 'GPIO3',  pin: 5,  secondary: 'SCL I2C'},
  {name: 'GPIO4',  pin: 7},
  {name: 'GPIO14', pin: 8,  secondary: 'UART0_TXD'},
  {name: 'GPIO15', pin: 10, secondary: 'UART0_RXD'},
  {name: 'GPIO17', pin: 11},
  {name: 'GPIO18', pin: 12, secondary: 'PCM_CLK'},
  {name: 'GPIO27', pin: 13},
  {name: 'GPIO22', pin: 15},
  {name: 'GPIO23', pin: 16},
  {name: 'GPIO24', pin: 18},
  {name: 'GPIO10', pin: 19, secondary: 'MOSI'},
  {name: 'GPIO9',  pin: 21, secondary: 'MISO'},
  {name: 'GPIO25', pin: 22},
  {name: 'GPIO11', pin: 23, secondary: 'SCLK'},
  {name: 'GPIO8',  pin: 24, secondary: 'CE0_N'},
  {name: 'GPIO7',  pin: 26, secondary: 'CE1_N'},
  {name: 'GPIO5',  pin: 29},
  {name: 'GPIO6',  pin: 31},
  {name: 'GPIO12', pin: 32},
  {name: 'GPIO13', pin: 33}
]; // PINS

// not included as they seem to crash the pi when called...
// {name: 'GPIO19', pin: 35}, {name: 'GPIO16', pin: 36}, {name: 'GPIO26', pin: 37}, {name: 'GPIO20', pin: 38}, {name: 'GPIO21', pin: 40}

module.exports = exports = function(config, log){

  /*
  "gpio": {
    "relays": {
      "1": {"id": 1, "name": "GPIO4", "pin": 7},
      "2": {"id": 2, "name": "GPIO17", "pin": 11},
      "3": {"id": 3, "name": "GPIO27", "pin": 13},
      "4": {"id": 4, "name": "GPIO22", "pin": 15}
    },
    "default": "NC"
  }
  */

  // create an empty array that will hold objects, one for each relay that we can manipulate
  var relays = [];

  // create a handler to unexport all relays in the event that the app crashes
  process.on('SIGINT', () => {
    log.fatal('SIGINT fired');
    relays.forEach((obj) => {
      console.log(relays.length);
    }); // _.forAll
    log.info('exiting SIGINT handler');
    process.exit();
  }); // process.on SIGINT

  /// helper functions

  // iterate over one or all of the pins and try and instantiate a gpio object for each, to see whether they can be opened
  function _testAvailability(specificPin){

    var available = [];
    var pins = []
    var current;
    var testPin;
    var msg;

    // are we testing one specific pin or all pins? Find the pin by ID or name, or use all pins from PINS
    if (specificPin){
      testPin = (_.isNumber(specificPin)) ? _.find(PINS, ['pin', specificPin]) : _.find(PINS, ['name', specificPin]) ;
      if (testPin !== undefined){
        log.trace('starting test of pin '+testPin.pin.toString()+' ('+testPin.name+')');
        pins.push(testPin);
      } else {
        msg = 'pin \''+specificPin.toString()+'\' not found';
        log.error(msg);
        return new Error(msg);
      }; // if
    } else {
      pins = PINS;
      log.trace('starting test for all '+PINS.length.toString()+' pins...');
    }; // if

    // iterate over the pin(s) and try and open it/them
    pins.forEach(obj => {
      log.trace('attempting to instantiate for pin '+obj.pin.toString()+' ('+obj.name+')');
      try {
        current = new Gpio(obj.pin, 'out'); // pin, direction, edge{}, options{}
        available.push(current);
      } catch(err) {
        msg = 'unable to instantiate pin '+obj.pin.toString()+' ('+obj.name+')';
        log.error(msg);
        return new Error(msg);
      }; // try/catch
    }); // pins.forEach

    // now clean up afterwards using unexport
    log.trace('finsihed iterating, now unexporting...');
    available.forEach(obj => {
      obj.unexport();
    });  // .forEach

    if (available.length == 1){
      log.trace('test completed')
    } else {
      log.trace('testing completed')
    }; // if

    return true;

  }; // _testAvailability

  function _gpioAccessible(){
    if (Gpio.accessible){
      return true;
    } else {
      return false;
    }; // if
  }; // _gpioAccessible

  function _initialiseRelaysArray(){

  }; // _initialiseRelaysArray

  /// module exports

  return {
    PINS:       PINS,
    initialise: _initialiseRelaysArray,
    accessible: _gpioAccessible,
    test:       _testAvailability
  }

  /*
  module.exports.setup = function (pin, direction){};

  module.exports.write = function (pin, value){};

  module.exports.PIN = {GPIO_0: "11"};
  */

}; // module.exports

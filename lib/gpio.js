// ./lib/gpio.js

'use strict';

var _          = require('lodash');
var bodyParser = require('body-parser');
var requestIp  = require('request-ip');
var rpio       = require('rpio');

const HIGH = 1;
const LOW  = 0;
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

  /// functions

  // set the state of a relay via a GPIO on or off (on = high, off = low)
  // accepts an object e.g. { id: 1, name: 'GPIO4', pin: 7, state: 'closed' }, and state 'on' or 'off'
  // returns a promise
  function _set(obj, state){

    return new Promise((resolve, reject) => {

      // validate obj and state parameters
      if (!obj.id || !obj.name || !obj.pin || !_.isNumber(obj.pin)){
        return reject(new Error('invalid object passed to _set in ./lib/gpio.js'))
      }; // if
      state = ([HIGH, 1, '1', true, 'open', 'on'].indexOf(state) === -1) ? LOW : HIGH ; // default to off (LOW)
      let stateText = (state === 1) ? 'high' : 'low' ;

      // create an object for the pin
      let current = rpio.open(obj.pin, rpio.OUTPUT, rpio.PULL_DOWN); // read-write with the internal pulldown resistor enabled

      // set the state and return result to caller after cleaning up
      rpio.write(obj.pin, state);
      log.trace('pin '+obj.pin.toString()+' ('+obj.name+') set to '+stateText);
      return resolve();

    }); // new promise

  }; // _set

  /// module exports

  return {
    PINS: PINS,
    set:  _set
  };

}; // module.exports

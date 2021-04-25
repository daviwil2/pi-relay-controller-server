// ./lib/gpio.js

'use strict';

var rpio = require('rpio');

const HIGH = 1;
const LOW  = 0;

// pin s35-40 seemed to crash a Pi Zero W when called...?
const PINS = [
  {pin: 1, secondary: '3V3'},
  {pin: 2, secondary: '5V'},
  {gpio: 'GPIO_2',  pin: 3,  name: 'SDA I2C'},
  {pin: 4, secondary: '5V'},
  {gpio: 'GPIO_3',  pin: 5,  name: 'SCL I2C'},
  {pin: 6, secondary: 'GND'},
  {gpio: 'GPIO_4',  pin: 7},
  {gpio: 'GPIO_14', pin: 8,  name: 'UART0_TXD'},
  {pin: 9, secondary: 'GND'},
  {gpio: 'GPIO_15', pin: 10, name: 'UART0_RXD'},
  {gpio: 'GPIO_17', pin: 11},
  {gpio: 'GPIO_18', pin: 12, name: 'PCM_CLK'},
  {gpio: 'GPIO_27', pin: 13},
  {pin: 14, secondary: 'GND'},
  {gpio: 'GPIO_22', pin: 15},
  {gpio: 'GPIO_23', pin: 16},
  {pin: 17, secondary: '3V3'},
  {gpio: 'GPIO_24', pin: 18},
  {gpio: 'GPIO_10', pin: 19, name: 'MOSI'},
  {pin: 20, secondary: 'GND'},
  {gpio: 'GPIO_9',  pin: 21, name: 'MISO'},
  {gpio: 'GPIO_25', pin: 22},
  {gpio: 'GPIO_11', pin: 23, name: 'SCLK'},
  {gpio: 'GPIO_8',  pin: 24, name: 'CE0_N'},
  {pin: 25, secondary: 'GND'},
  {gpio: 'GPIO_7',  pin: 26, name: 'CE1_N'},
  {gpio: 'GPIO_5',  pin: 29, name: 'RELAY_4', relay: 4},
  {pin: 30, secondary: 'GND'},
  {gpio: 'GPIO_6',  pin: 31, name: 'RELAY_3', relay: 3},
  {gpio: 'GPIO_12', pin: 32},
  {gpio: 'GPIO_13', pin: 33, name: 'RELAY_2', relay: 2},
  {pin: 34, secondary: 'GND'},
  {gpio: 'GPIO_19', pin: 35, name: 'RELAY_1', relay: 1},
  {gpio: 'GPIO_16', pin: 36},
  {gpio: 'GPIO_26', pin: 37},
  {gpio: 'GPIO_20', pin: 38},
  {pin: 39, secondary: 'GND'},
  {gpio: 'GPIO_21', pin: 40}
]; // PINS

module.exports = exports = function(config, log, db){

  /// functions

  // set the state of a relay via a GPIO on or off (on = high, off = low)
  // accepts an object with .pin, .relay, .gpio and/or .name, and state 'on' or 'off'
  // returns a promise
  function _set(obj, state){

    return new Promise((resolve, reject) => {

      let pin, o;

      // validate obj to ensure we have at least one attribute we can use to lookup the pin
      if (!obj.pin && !obj.relay && !obj.gpio && !obj.name){
        return reject(new Error('invalid object passed to _set in ./lib/gpio.js'))
      }; // if

      // lookup the pin number from the attribute passed
      pin = null;

      // obj.pin
      pin = (obj.pin && typeof obj.pin === 'number' && obj.pin >= 1 && obj.pin <= 40) ? obj.pin : pin;

      // obj.relay
      if (pin === null && obj.relay && typeof obj.relay === 'number' && obj.relay >= 1 && obj.relay <= 4){
        o = PINS.find((element) => { element.relay === obj.relay }); // search the array of elements for one with this relay
        pin = o ? o.pin : null ; // if it's found store the pin number
      }; // if

      // obj.gpio
      if (pin === null && obj.gpio && typeof obj.gpio === 'string'){
        o = PINS.find((element) => { element.gpio === obj.gpio }); // search the array of elements for one with this relay
        pin = o ? o.pin : null ; // if it's found store the pin number
      }; // if

      // obj.name
      if (pin === null && obj.name && typeof obj.name === 'string'){
        o = PINS.find((element) => { element.name === obj.name }); // search the array of elements for one with this relay
        pin = o ? o.pin : null ; // if it's found store the pin number
      }; // if

      // trap for no match
      if (pin === null){ return reject(new Error('pin couldn\'t be identified in _set in ./lib/gpio.js')) };

      // validate that this pin is settable, i.e. that it is a GPIO
      o = PINS.find((element) => { element.pin === pin });
      if (!o || !o.gpio){return reject(new Error('pin '+pin.toString()+' isn\'t a valid GPIO')) };

      // define the state to which we'll change the pin, defaulting to off (LOW) if one of the valid states for high isn't found
      state = ([HIGH, 1, '1', true, 'open', 'on'].indexOf(state) === -1) ? LOW : HIGH ;
      let stateText = (state === 1) ? 'high' : 'low' ;

      // enable write access (technically read-write) with the internal pulldown resistor enabled
      rpio.open(pin, rpio.OUTPUT, rpio.PULL_DOWN);

      // add a callback to an event watcher to be fired when the pin goes high or low
      rpio.poll(pin, (pin) => {

        log.trace('poll callback triggered for pin '+pin.toString());

        // TODO: set the new state in the database via db., when lowdb is implemented

        rpio.poll(pin, null); // disable the poll

      }).bind(this);

      // set the state
      rpio.write(pin, state);

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

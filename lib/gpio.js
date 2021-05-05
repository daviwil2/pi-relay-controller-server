// ./lib/gpio.js

'use strict';

var rpio = require('rpio');

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

const HIGH = 1;
const LOW  = 0;
const ON   = HIGH;
const OFF  = LOW

module.exports = exports = function(config, log, db){

  /// declare constants and variables that have scope across all functions in this module

  var polling = []; // for which pins have we set gpio.poll?

  /// functions

  /*
  function _setAllRelays(state){
    if (typeof state !== 'boolean'){ return new Error('invalid state passed in _setAllRelays') };
    state = ([HIGH, 1, '1', true, 'open', 'on'].indexOf(state) === -1) ? LOW : HIGH ;
    let stateText = (state === HIGH) ? 'on' : 'off' ;
    PINS.forEach((obj) => {
      if (obj.relay){
        log.trace('setting state for relay '+obj.relay.toString()+' to '+stateText);
        rpio.open(obj.pin, rpio.OUTPUT, rpio.PULL_DOWN);
        rpio.write(obj.pin, state);
        db.setRelayState(obj.relay, state); // set the state in the database; obj.relay is [1-4], state is true or false === on or off
      }; // if
    }); // PINS.forEach
  }; // _setAllRelays
  */

  // set the state of a relay via a GPIO on or off (on = high, off = low)
  // accepts an object with .pin, .relay, .gpio and/or .name, and state 'on' or 'off'
  // returns a promise
  function _set(obj, state){

    return new Promise((resolve, reject) => {

      let pin, o;

      // validate obj to ensure we have at least one attribute we can use to lookup the pin
      if (!obj.relay){
        return reject(new Error('invalid object passed to _set in ./lib/gpio.js, \'relay\' attribute missing'))
      }; // if

      // we'll lookup the pin number from the relay attribute passed
      pin = null;

      // obj.relay
      if (pin === null && obj.relay && typeof obj.relay === 'number' && obj.relay >= 1 && obj.relay <= 4){
        o = PINS.find((element) => { return element.relay === obj.relay }); // search the array of elements for the first one with this relay
        pin = o ? o.pin : null ; // if it's found store the pin number
      }; // if

      // trap for no match
      if (pin === null){ return reject(new Error('pin couldn\'t be identified in _set in ./lib/gpio.js')) };

      // validate that this pin is settable, i.e. that it is a GPIO
      o = PINS.find((element) => { return element.pin === pin });
      if (!o || !o.gpio){return reject(new Error('pin '+pin.toString()+' isn\'t a valid GPIO')) };

      // trap for already acting on this relay
      if (polling.indexOf(pin) !== -1){
        return reject(new Error('already perfoming a state change action on pin '+pin.toString()));
      }; // if

      // define the state to which we'll change the pin, defaulting to off (LOW) if one of the valid states for high isn't found
      state = ([HIGH, 1, '1', true, 'open', 'on'].indexOf(state) === -1) ? LOW : HIGH ;
      let stateText = (state === 1) ? 'high' : 'low' ;

      log.trace('setting '+o.gpio+' for relay '+o.relay+' on pin '+pin.toString()+' to '+stateText);

      // enable write access (technically read-write) with the internal pulldown resistor enabled
      rpio.open(pin, rpio.OUTPUT, rpio.PULL_DOWN);

      log.trace('pin '+pin.toString()+' opened for output');

      // add a callback to an event watcher to be fired when the pin goes high or low
      if (polling.indexOf(pin) === -1){

        polling.push(pin); // add it to the array

        rpio.poll(pin, (pin) => {
          log.trace('poll callback triggered for pin '+pin.toString());
          db.setRelayState(obj.relay, state); // set the state in the database; obj.relay is [1-4], state is true or false === on or off
          rpio.poll(pin, null); // disable the poll
          polling.splice(polling.indexOf(pin), 1); // remove the pin from the array of pins that have an active poll
          return resolve();
        }); // rpio.poll

      }; // if

      // set the state
      rpio.write(pin, state);

      log.trace('state written to '+pin.toString());

    }); // new promise

  }; // _set

  /// module exports

  return {
    PINS : PINS,
    set  :  _set
  };

}; // module.exports

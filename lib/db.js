// ./lib/db.js

'use strict';

// lowdb database
var low         = require('lowdb');
var FileSync    = require('lowdb/adapters/FileSync');

module.exports = exports = function(config, log){

  var adapter     = new FileSync(config.db.filename);
  var db          = low(adapter);

  /// internal functions

  function _initialise(){

    // check to ensure that the database is populated; if not, initialise it with default values from the config
    if (db.has('relays').value() === false || db.get('relays').size().value() === 0){
      log.debug('database is empty, initialising using values from config.yml');
      db.set('relays', config.gpio.relays).write();
    } else {
      log.trace('database already initialised');
    }; // if

  }; // _initialise

  // pass null for all relays or a numeric 1-4 for a specific relay, plus an errback
  function _getRelays(relay, callback){

    let relays = db.get('relays').value(); // get all the relays from the database

    // if relay isn't null then check that it's a number [1-4] and then filter for just that relay
    if (relay !== null){
      if (typeof relay !== 'number' || relay < 1 || relay > 4){ // validate that it's a number [1-4]
        callback(new Error('malformed relay number passed to getRelays'), {succeeded: false});
        return;
      }; // if
      relays = relays.filter((el) => { return el.relay === relay }); // filter the array for just the relay we want to return
    }; // if

    // errback with the array containing one or all of the relays as objects
    callback (null, relays);

  }; // _getRelays

  function _setRelayState(relay, state){
    db.get('relays').find({relay: relay}).assign({state: state}).write();
  }; // _setRelayState

  function _renameRelay(relay, newName){
    db.get('relays').find({relay: relay}).assign({name: newName}).write();
  }; // _renameRelay

  /// module exports

  return {
    initialise    : _initialise,
    getRelays     : _getRelays,
    setRelayState : _setRelayState,
    renameRelay   : _renameRelay
  };

};

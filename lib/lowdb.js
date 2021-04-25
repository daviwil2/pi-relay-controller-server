// ./lib/lowdb.js

'use strict';

// lowdb database
var low         = require('lowdb');
var FileSync    = require('lowdb/adapters/FileSync');

var adapter, db;

module.exports = exports = function(config, log){

  /// functions

  function _initialise(){

    try {

      adapter = new FileSync(config.db.filename);
      db = low(adapter);

      // check to ensure that the database is populated; if not, initialise it with default values from the config
      if (db.has('relays').value() === false || db.get('relays').size().value() === 0){
        log.debug('database is empty, initialising using values from config.yml');
        db.set('relays', config.gpio.relays).write();
      } else {
        log.trace('database already initialised');
        console.log(db.get('relays').find({relay: 1}).value())
      }; // if

    } catch(err) {

      return(err);

    }; // if

  }; // _initialise

  /// module exports

  return {
    initialise:  _initialise
  };

};

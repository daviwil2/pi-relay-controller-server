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

  function _getRelays(){
    return db.read('relays').values();
  }; // _getRelays

  function _retrieveCertificates(){
    return db.has('certificates').value() ? db.get('certificates').value() : null ;
  }; // _retrieveCertificates

  function _storeCertificates(certificates){
    db.set('certificates', certificates).write();
    log.trace('certificates written to the database');
    return;
  }; // _storeCertificates

  /// module exports

  return {
    initialise           : _initialise,
    getRelays            : _getRelays,
    retrieveCertificates : _retrieveCertificates,
    storeCertificates    : _storeCertificates
  };

};

// ./app.js

'use strict';

// gRPC
var grpc        = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');

// YAML 1.2 parser
var yaml        = require('js-yaml');
var fs          = require('fs');

// load configuration from YAML file
try {
  var config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch(err) {
  process.exit(0);
}; // try/catch

var log         = require('./lib/log.js')(config);
var db          = require('./lib/lowdb.js')(config, log);
var gpio        = require('./lib/gpio.js')(config, log, db);

var stub, server;

// call function to validate that the database is present and, if not, initialise it
db.initialise((err) => {
  if(err){
    log.fatal(err.message);
    process.exit(0);
  }; // if
}); // db.initialise

const MAXTIMEOUT      = 10000; // 10000ms = 10s
const DEFAULTTIMEOUT  = 2000;  // 2000ms = 2s
const MAXINTERVAL     = 1000;  // 1000ms = 1s
const DEFAULTINTERVAL = 50;    // 50ms = 0.05s

// define how the relay is in an off state; if NC then 0 if NO then 1
const OFF = (config.gpio.default == 'NC') ? 0 : 1 ;
const ON  = (OFF === 0) ? 1 : 0 ;

log.debug('running versions '+_reformatObject(process.versions, true));

var address = config.gRPC.server.host+':'+config.gRPC.server.port.toString();
var serverCredentials = grpc.ServerCredentials.createInsecure();

// build the gRPC API
const PROTO_PATH = __dirname + '/com/github/daviwil2/grpc/v1/service.proto'; // this is the master protobuf file that loads all the dependent files
var packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  { keepCase: true, // preserve field names, don't convert to camelCase
    longs: "String",
    enums: "String",
    defaults: true,
    oneofs: true
  }
); // var packageDefinition
var protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

/*
 * The protoDescriptor object has the full package hierarchy
 * The stub constructor is in the service namespace (protoDescriptor.com...) and the service
 * descriptor (which is used to create a server) is a property of the stub (service.service)
 * Per the API defined in service.proto the methods GetPins() and SetPin() are defined on .service
*/
stub = protoDescriptor.com.github.daviwil2.grpc.v1.PiRelayService;

/// helper functions

function _reformatObject(obj, suppressApostrophes){

  let apostrophe = (suppressApostrophes) ? '' : '\'';
  let formatted = '';
  let array = Object.keys(obj); // an array of all the keys in the object

  if (array.length === 0){ return null }; // trap for empty object

  if (array.length == 1 ){ return apostrophe+array[0]+' '+obj[array[0]]+apostrophe}; // trap for one key/value pair

  // we have at least two key/value pairs in the object
  for (let i=0; i<array.length-1; i++){
    formatted = formatted + apostrophe + array[i] + ' ' + obj[array[i]] + apostrophe;
    if (i<array.length-2) {formatted = formatted + ', '};
  }; // for
  formatted = formatted + ' and ' + apostrophe + array[array.length-1] + ' ' + obj[array[array.length-1]] + apostrophe;

  return formatted;

}; // _reformatObject

function _waitForServerToStart(server, timeout, interval){

  let timeoutFunction, waitFunction;

  timeout  = (timeout  && typeof timeout === 'number'  && timeout > 0  && timeout < MAXTIMEOUT)   ? timeout  : DEFAULTTIMEOUT ;
  interval = (interval && typeof interval === 'number' && interval > 0 && interval < MAXINTERVAL) ? interval : DEFAULTINTERVAL ;

  return new Promise((resolve, reject) => {

    // start a function that after the timeout will reject
    timeoutFunction = setTimeout(() => {
      clearTimeout(waitFunction);
      reject(new Error('timed out'));
    }, timeout);

    // define a function that will check the condition and resolve if it is truthy, recursively callingitself
    function _wait(){
      if (server.started){
        clearTimeout(waitFunction);
        clearTimeout(timeoutFunction);
        return resolve()
      }; // if
      waitFunction = setTimeout(_wait, interval);
    }; // _wait

    // perform initial execution of the _wait function
    waitFunction = setTimeout(_wait, interval);

  }); // return new Promise

}; // _waitForServerToStart

/// define functions called by gRPC API calls

// get one or all pins from lowdb; {obj.request.relay} will be 0 for all relays or 1-4 for one of the available relays
function _getRelays(obj, callback){

  console.log('_getRelays() called');
  console.log('obj.request', obj.request); // should be an object with .relay
  console.log(obj.request.relay)
  console.log('callback is a', typeof callback);

  // read from lowdb here via db. calls
  // db.getRelays

  //  mock
  let response = {piRelays: [{pin: 'PIN_33', name: 'fred'}, {name: 'joe'}]}; // 'PIN_33' is returned a number 3 per .proto file enum definitions, all other fields default to 0 etc.

  callback(null, response);

}; // _getRelays

// set the state of the relay returning (err, result)
function _setRelay(relay, desiredState, callback){

  desiredState = ([1, '1', true, 'open', 'on'].indexOf(desiredState) === -1) ? OFF : ON ; // default to OFF
  let desiredStateText = (desiredState === ON) ? 'on' : 'off' ;

  // trap for malformed relay number
  if (relay == undefined || typeof relay !== 'number'){
    return (new Error('relay number not passed or malformed in _setRelay'), null);
  }; // if

  // set the relay state which will trigger the database update in a callback via a .poll
  log.trace('setting state of relay '+relay+' to '+desiredStateText);
  gpio.set({relay: relay}, desiredState); // function imported from ./lib/gpio.js

  callback(null, {relay: relay, state: desiredState});

}; // _setRelay

function _renameRelay(relay, newName, callback){

}; // _rename

/// gRPC server starts here

// define a gRPC server
server = new grpc.Server();

// add services with local functions getPins and setPin mapping to the API functions GetPins and SetPin
server.addService(stub.service, {
  GetRelays: _getRelays,
  SetRelay: _setRelay,
  RenameRelay: _renameRelay
}); // server.addService

// bind and start the gRPC server
server.bindAsync(config.gRPC.server.host+':'+config.gRPC.server.port.toString(),
  serverCredentials,
  (err, port) => {
    if (err){
      log.fatal(err.message);
      process.exit(0);
    } else {

      log.trace('server bound on '+config.gRPC.server.host+':'+port+', starting server');
      server.start();

      _waitForServerToStart(server, 2500, 50)
      .then(() => {
        log.debug('server started and listening...');
      })
      .catch((err) => {
        log.fatal(err.message);
        process.exit(0);
      }); // _waitForServerToStart

    }; // if
}); // server.bindAsync

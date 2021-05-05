// ./app.js for pi-relay-controller-server

'use strict';

// gRPC
var grpc        = require('@grpc/grpc-js');
var protoLoader = require('@grpc/proto-loader');

// YAML 1.2 parser
var yaml        = require('js-yaml');
var fs          = require('fs');
let networkInterfaces = require('os').networkInterfaces;

// load configuration from YAML file
try {
  var config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch(err) {
  process.exit(0);
}; // try/catch

var mdns        = require('mdns');

var log         = require('./lib/log.js')(config);           // logger
var db          = require('./lib/db.js')(config, log);       // abstracts access to the lowdb database
var gpio        = require('./lib/gpio.js')(config, log, db); // allows control of the GPIO pins

var stub, server, advertisment, serverCredentials;

// validate that the database is present and, if not, initialise it
db.initialise((err) => {
  if(err){
    log.fatal(err.message);
    process.exit(0);
  }; // if
}); // db.initialise

// define constants
const MAXTIMEOUT      = 10000; // 10000ms = 10s
const DEFAULTTIMEOUT  = 2000;  // 2000ms = 2s
const MAXINTERVAL     = 1000;  // 1000ms = 1s
const DEFAULTINTERVAL = 50;    // 50ms = 0.05s

const OFF             = 0;     // low
const ON              = 1;     // high

log.debug('running versions '+_reformatObject(process.versions, true));

// create gRPC server instance; we use insecure rather than SSL/TLS as the latter isn't suppotted on ARM processors
log.trace('creating serverCredentials as insecure');
serverCredentials = grpc.ServerCredentials.createInsecure();

var port    = config.gRPC.server.port.toString();
var address = config.gRPC.server.host;

// build the gRPC API
const PROTO_PATH = __dirname + '/com/github/daviwil2/grpc/v1/service.proto'; // this is the master protobuf file that loads all the dependent files
var packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  { keepCase: true, // preserve field names, don't convert to camelCase
    longs: 'String',
    enums: 'String',
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

// set the state of all teh relays to off and update the database with that state
log.trace('setting all relays to '+config.initialState);
let initialState = (config.initialState === 'on') ? 1 : 0 ;
for (let r = 1; r <= 4; r++){
  _setRelay({request: {relay: r, state: 0}}, (err, response) => {} );
}; // for

/// internal helper functions

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

    // define a function that will check the condition and resolve if it is truthy, recursively calling itself
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

function _validateMDNSPublication(){

  log.trace('validating MDNS publication...');

  // build a list of IP addresses on this host
  let interfaces = networkInterfaces();
  let results = [];
  let name, i;

  for (name of Object.keys(interfaces)) {
    for (i of interfaces[name]) {
      if (i.family === 'IPv4' && !i.internal) { // ignore IPv6 and internal addresses
        results.push(i.address);
      }; // if
    }; // for
  }; // for

  let message = (results.length == 1) ? 'interface' : 'interfaces';
  log.trace('found ' + results.length.toString() + ' ' + message);

  let sequence = [
    mdns.rst.DNSServiceResolve() // resolve host name and port
  ]; // sequence
  var browser = mdns.createBrowser(mdns.tcp('grpc'), { resolverSequence: sequence });

  log.trace('MDNS browser instance created');

  browser.on('serviceUp', function(service) {
    if (service.txtRecord && service.txtRecord.ip){
      if (results.indexOf(service.txtRecord.ip) !== -1){
        log.trace('server successfully published on mDNS-SD at address '+address);
        browser.stop();
        log.trace('MDNS browser instance stopped');
      }; // if
    }; // if
  }); // browser.on

  browser.on('error', (err) => { log.error(err.message) });

  browser.start();

}; // _validateMDNSPublication

function _validategRPCserver(address, port){

  // build the gRPC API
  // PROTO_PATH, packageDefinition, protoDescriptor and stub are all defined earlier when the server was instantiated

  let client;

  log.info('trying to open test gRPC connection to '+address+':'+port);

  client = new stub(address+':'+port, grpc.credentials.createInsecure());
  log.trace('calling client.getRelays() over secure gRPC connection');

  // make gRPC call over the connection
  client.getRelays({}, (err, data) => {
    if (err){
      log.error('failed: '+err.message)
    } else {
      let message = (data.piRelays.length > 1) ? ' relays' : ' relay' ;
      log.trace('succeeded: records for ', data.piRelays.length.toString() + message + ' returned');
    }; // if
  }); // client.getRelays

}; // _validategRPCserver

/// define the functions defined as the API for gRPC calls

// get one or all pins from lowdb; {obj.request.relay} will be 0 for all relays or 1-4 for one of the available relays
function _getRelays(obj, callback){

  // construct paramter; either null for all relays or a number [1-4] for a specific relay
  let parameter = (obj.request && obj.request.hasOwnProperty('relay') && obj.request.relay !== 0) ? obj.request.relay : null ;

  db.getRelays(parameter, (err, response) => {
    if (err){
      log.error('error returned when calling db.getRelays: '+err.message);
      callback(err, {piRelays: []} );
    } else {
      let plural = (response.length === 1) ? 'relay' : 'relays' ;
      log.trace('returning data for '+response.length.toString()+' '+plural);
      callback(null, {piRelays: response});
    }; // if
  }); // db.getRelays

}; // _getRelays

// set the state of the relay returning (err, result)
function _setRelay(obj, callback){

  if (!obj.request || !obj.request.hasOwnProperty('relay') && !obj.request.hasOwnProperty('state')){
    callback(new Error('incorrect parameters passed to _setRelay'))
  }; // if

  let desiredState = ([1, '1', true, 'open', 'on'].indexOf(obj.request.state) === -1) ? OFF : ON ; // default to OFF
  let desiredStateText = (desiredState === OFF) ? 'off' : 'on' ;
  let relay = obj.request.relay;

  // trap for malformed relay number
  if (relay === null || typeof relay !== 'number' || relay <1 || relay >4){
    callback(new Error('relay number not passed or malformed in _setRelay'), null);
  }; // if

  // set the relay state which will trigger the database update in a callback via a .poll in ./lib/gpio.js
  log.trace('setting state of relay '+relay+' to '+desiredStateText);
  let timestamp = Math.round((new Date()).getTime() / 1000); // get unix timestamp, i.e. the seconds since start of unix epoch
  gpio.set({relay: relay}, desiredState)
  .then(() => {
    log.trace('successfully set state of relay '+relay+' to '+desiredStateText);
    callback(null, {timestamp: {seconds: timestamp, nanos: 0}, relay: relay, succeeded: true, state: desiredState});
  })
  .catch((err) => {
    log.error('error setting state of relay '+relay+' to '+desiredStateText+': '+err.message);
    callback(err, {timestamp: {seconds: timestamp, nanos: 0}, relay: relay, succeeded: false, state: desiredState});
  });

}; // _setRelay

// TODO: rename a relay; obj.relay, obj.oldName, obj.newName
function _renameRelay(obj, callback){

  let relay = obj.request.relay;
  let newName = obj.request.newName;

  // write the new name to the database
  db.renameRelay(relay, newName);

  // construct the response object
  let timestamp = Math.round((new Date()).getTime() / 1000); // get unix timestamp, i.e. the seconds since start of unix epoch
  let response = callback(null, {timestamp: {seconds: timestamp, nanos: 0}, relay: 1, succeeded: true});

  log.trace('renamed relay '+relay.toString()+' to \''+newName+'\'');

  // return errback with no error and the response object
  callback(null, response);

}; // _renameRelay

/// gRPC server starts here

// define a gRPC server
server = new grpc.Server();

// add methods that this server implements, mapped to functions above
server.addService(stub.service, {
  GetRelays   : _getRelays,
  SetRelay    : _setRelay,
  RenameRelay : _renameRelay
}); // server.addService

// bind the serverCredentials instance we created earlier and then start the gRPC server
server.bindAsync(address+':'+port, serverCredentials, (err, port) => {

  if (err){

    log.fatal('error when binding server: ' + err.message);
    process.exit(0);

  } else {

    log.trace('server bound on '+address+':'+port+', starting...');
    server.start();

    _waitForServerToStart(server, 2500, 50)
    .then(() => {

      log.debug('server started and listening...');

      // advertise this server using MDNS
      let txtRecord = {id: 'pi-relay', type: 'controller', ip: address, port: port};
      advertisment = mdns.createAdvertisement(mdns.tcp('grpc'), port, {txtRecord: txtRecord});
      advertisment.start();
      log.debug('advertising server via mDNS-SD');

      _validateMDNSPublication(); // look for the MDNS advertisement to ensure it was successfully published
      _validategRPCserver(address, port); // validate that the gRPC server is running correctly

    })
    .catch((err) => {

      log.fatal(err.message);
      process.exit(0);

    }); // _waitForServerToStart

  }; // if

}); // server.bindAsync

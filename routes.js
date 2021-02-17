// ./routes/routes.js

'use strict';

module.exports = exports = function(app, config, log){

  var _          = require('lodash');
  var express    = require('express');
  var bodyParser = require('body-parser');
  var gpio       = require('./lib/gpio.js')(config, log);

  var relays     = []; // array to act as master list of relays defined in config.json and their current state

  // use an undocumented setting for express.js to set the formatting of stringified json so the /status path is formatted in a more readable style
  app.set('json spaces', 4);

  // define how the relay is in an off state; if NC then 0 if NO then 1
  const OFF = (config.gpio.default == 'NC') ? 0 : 1 ;
  const ON  = (OFF === 0) ? 1 : 0 ;

  // populate the relays array with an object for each relay, {id, name, pin, state}
  _.forEach(config.gpio.relays, (obj, key) => {
    obj.state = 'off'; // add the default state, off or on, to the object
    relays.push(obj); // add the object to the array
  }); // _.forEach

  // reset all relays to defaultState
  let index;
  log.info('resetting all relays to off');
  relays.forEach((obj) => {
    log.debug('setting pin '+obj.pin.toString()+' ('+obj.name+') to off');
    gpio.set(obj, OFF)
    .then(() => {
      index = _.findIndex(relays, ['pin', obj['id']]);
      if (index !== -1){
        relays[index]['state'] = 'off'
      }; // if
    })
    .catch((err) => {});
  }); // relays.forEach((item, i) => {
  log.debug('finished resetting all relays to off');

  /// helper functions

  /// express middleware

  // this middleware is fired for all requests
  app.use(function(req, res, next){
    return next();
  }); // app.use

  /// express routes

  // home
  app.get('/', function(req, res, next){
    res.status(200).json({status: "ok"})
  }); // app.get

  // returns the array of relays
  app.get('/API/relays', function(req, res, next){
    res.status(200).json({relays: relays})
  }); // app.get

  // set the state of a relay
  // req.query.relay and .state specifies the relay to change and the desired state, e.g. /API/set?relay=1&state=1
  app.put('/API/set', bodyParser.json(), function(req, res, next){

    let relay = (req.query.relay) ? req.query.relay : undefined ;
    relay = (relay !== undefined) ? parseInt(relay, 10) : undefined ;

    let desiredState = (req.query.state) ? req.query.state : undefined ;
    desiredState = ([1, '1', true, 'open', 'on'].indexOf(desiredState) === -1) ? OFF : ON ; // default to OFF

    let desiredStateText = (desiredState === ON) ? 'on' : 'off' ;

    let index, obj;

    // trap for malformed relay number
    if (relay == undefined || typeof relay !== 'number'){
      return res.status(400).type('json').json(new Error('relay number not passed or malformed')); // 400 (Bad Request)
    }; // if

    // get the relay object's index and obj from the array
    index = _.findIndex(relays, ['id', relay]);
    if (index === -1){
      return res.status(400).type('json').json(new Error('specified relay not found')); // 400 (Bad Request)
    } else {
      obj = relays[index];
    }; // if

    log.trace('setting state of pin '+obj.pin+' to '+desiredStateText);
    gpio.set(obj, desiredState);
    relays[index]['state'] = desiredStateText ;

    return res.status(200).type('json').json({});

  }); // app.put

  /// error messages, need to be replaced with handlebars-rendered pages that can be displayed in the main region

  // 404 path not found
  app.use(function(req, res, next) {
    log.error('404 error: '+req.path);
    res.status(404);
    res.render('404');
  }); // app.use

  // 500 internal server error
  app.use(function(err, req, res, next) {

    // from the V8 stack extract the location of the error
    var where = err.stack.split(/\r?\n/)[1].trim();
    var array = where.split(/:/);
    where = array[0].split(' ')[1].trim()+' line '+array[1]+' character '+array[2];

    log.error('500 error: '+err.message+' in '+where);
    res.status(500);
    res.render('500', {
      err: err
    }); // res.render

  }); // app.use

} // module.exports

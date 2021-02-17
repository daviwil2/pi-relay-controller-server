// ./routes/routes.js

'use strict';

module.exports = exports = function(app, config, log){

  var _       = require('lodash');
  var express = require('express');
  var gpio    = require('./lib/gpio.js')(config, log);

  // use an undocumented setting for express.js to set the formatting of stringified json so the /status path is formatted in a more readable style
  app.set('json spaces', 4);

  /// helper functions

  // create an array with an object for each relay, {number, state, gpio)
  var relays = [];
  let defaultState = (config.gpio.default == 'NC') ? 'closed' : 'open' ; // define default state
  if (gpio.accessible()){
    _.forEach(config.gpio.relays, (obj, key) => {
      if (gpio.test(obj.pin) === true){ // test each pin defined in config.json to ensure it's accessible before adding it to the array
        obj.state = defaultState; // add the state, open or closed, to the object
        relays.push(obj); // add the object to the array
      }; // if
    }); // _.forEach
  } else {
    log.fatal('gpio is not accessible')
  }; // if

  /// express routes

  // home
  app.get('/', function(req, res, next){
    res.status(200).json({status: "ok"})
  }); // app.get

  // returns array of relays as defined in config.json
  app.get('/relays', function(req, res, next){
    res.status(200).json({relays: config.gpio.relays})
  }); // app.get

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

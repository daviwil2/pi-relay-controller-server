// ./lib/ssl.js

'use strict';

var selfsigned = require('selfsigned');

module.exports = exports = function(config, log, db){

  /// internal helper functions not exposed on this library's API

  function _generateCertificates(callback){

    // build attributes object
    let attributes = (config.ssl.defaults && config.ssl.defaults.length > 0) ? config.ssl.defaults : [] ;
    let options = (config.ssl.options && typeof config.ssl.options === 'object' && Object.keys(config.ssl.options).length > 0) ? config.ssl.options : {} ;

    let certificates;
    try {
      certificates = selfsigned.generate(attributes, options);
      callback(null, certificates);
    } catch (err) {
      callback(err, null);
    }; // try/catch

  }; // _generateCertificates

  /// functions that are callable on the API

  function _getCertificates(){

    // try and get the certificates from the database
    let certificates = db.retrieveCertificates();

    // if we successfully retrieved the certificates from the database then return them to the caller
    if (!certificates || config.ssl.forceRegenerate){

      if (config.ssl.forceRegenerate){
        log.trace('force regeneration of certificates triggered')
      } else {
        log.trace('certificates not found in the database, generating')
      }; // if

      certificates = _generateCertificates((err, certificates) => {
        if (err){
          log.error('error returned when generating certificates: '+err.message.toLowerCase());
          process.exit(0);
        } else {
          db.storeCertificates(certificates);
          log.trace('new certificates generated and written to database')
        }; // if
      }); // certificates

    } else {

      log.trace('certificates found in the database');

    }; // if

    certificates = (certificates)
      ? [ { private_key: Buffer.from(certificates.private, 'utf8'), cert_chain: Buffer.from(certificates.cert, 'utf8') } ]
      : null ;

    return certificates;

  }; // _certificates

  return {
    getCertificates: _getCertificates
  };

}; // module.exports

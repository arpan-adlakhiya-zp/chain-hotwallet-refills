const validate = require('./validate');
const schema = require('./schema');
const _ = require('lodash');
let config = {};
let secret = {};

// read and validate the configurations
const configRc = require('rc')(`${schema.appName}_CONFIG`, {});
const secretRc = require('rc')(`${schema.appName}_SECRET`, {});

// schema should be available for config
let configRes = validate(configRc,schema.config);
if(configRes.status){
  config = configRes.parsed;
}
else{
  console.log("Error validating configurations exiting...");
  console.log("Errors: ",configRes.errors);
  process.exit(1);
}

if("secret" in schema){
  let secretRes = validate(secretRc,schema.secret);
  if(secretRes.status){
    secret = secretRes.parsed;
  }
  else{
    console.log("Error validating secrets exiting...");
    console.log("Errors: ",secretRes.errors);
    process.exit(1);
  }
}

function get(key){
  // check whether this key is available in the config
  return _.get(config,key,null);
}

function getSecret(key){
  // check whether this key is available in secret
  return _.get(secret,key,null);
}

function getAllConfig(){
  return config;
}
module.exports = {get,getSecret,getAllConfig};

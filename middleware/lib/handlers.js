/*
 *
 * Request handlers
 */

/* dependencies */
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');


//define the handlers
var handlers = {
    'ping' : function(data, callback) {
        callback(200);
    },
    'notFound' : function(data, callback) {
        callback(404);
    },
    'users' : function(data, callback) {
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if(acceptableMethods.indexOf(data.method) > -1){
            handlers._users[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    /* what do we need  */
    '_users' : {
        'post' : function(data, callback){
            
            var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
            var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
            var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
            var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
            var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? data.payload.tosAgreement : false;
            
            if(firstName && lastName && phone && password && tosAgreement) {
                //make sure the user does not already exist
                _data.read('users', phone, function(err){
                    if(err){
                        //user does not exist so continue POST
                        var hashedPassword = helpers.hash(password);
                        if(hashedPassword){
                            var userObject = {
                                'firstName' : firstName,
                                'lastName' : lastName,
                                'phone' : phone,
                                'hashedPassword' : hashedPassword,
                                'tosAgreement' : true
                            };
    
                            //store the user
                            _data.create('users', phone, userObject, function(err){
                                if(!err){
                                    callback(200);
                                } else {
                                    console.log(err);
                                    callback(500, {'Error' : 'Could not create the new user'});
                                }
                            });
                        } else {
                            callback(500, {'Error' : 'Could not hash the password'});
                        }
                        

                    } else{
                        callback(400, {'Error' : 'A user with that phone number already exists'});
                    }
                });

            } else {
                callback(400, {'Error': 'Missing required fields'});
            }

        },
        'get' : function(data, callback){
            var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
            if(phone) {

                //get the token from the header
                var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
                handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
                    if(tokenIsValid) {
                        //continue
                        _data.read('users', phone, function(err, data){
                            if(!err && data){
                                //continue
                                //remove the hashed password from the user object before returning it to the requester
                                delete data.hashedPassword;
                                callback(200, data);
                            } else {
                                callback(404);
                            }
                        });
                    } else {
                        callback(403, {'Error' : 'Missing required token in header or token is invalid'})
                    }
                });
                
            } else {
                callback(400, {'Error': 'Missing required field'});
            }
        },
        'put' : function(data, callback){
            //check for the required field 
            
            var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
            
            //check for the optional fields
            var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
            var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
            var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
            
            if(phone) {
                if(firstName || lastName || password) {
                    //look-up the user,
                    //get the token from the header
                    var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
                    handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
                        if(tokenIsValid) {
                            _data.read('users', phone, function(err, userData){
                                if(!err && userData) {
                                    if(firstName) {
                                        userData.firstName = firstName;
                                    }
                                    if(lastName) {
                                        userData.lastName = lastName;
                                    }
                                    if(password) {
                                        userData.hashedPassword = helpers.hash(password);
                                    }
                                    
                                    //store the new updates
                                    _data.update('users', phone, userData, function(err){
                                        if(!err) {
                                            callback(200);
                                        } else {
                                            console.log(err);
                                            callback(500, {'Error' : 'Could not update the user'});
                                        }
                                    });
                                } else {
                                    callback(400, {'Error' : 'The specified user does not exist.'});
                                }
                            });
                        } else {
                            callback(403, {'Error' : 'Missing required token in header or token is invalid'});
                        }
                    });
                    
                } else {
                    callback(400, {'Error' : 'Missing fields to update.'});
                }
            } else {
                callback(400, {'Error' : 'Missing required field'})
            }

        },
        'delete' : function(data, callback){
            var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
            if(phone) {
                var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
                handlers._tokens.verifyToken(token, phone, function(tokenIsValid){
                    if(tokenIsValid) {
                        _data.read('users', phone, function(err, data){
                            if(!err && data){
                                //delete the data
                                _data.delete('users', phone, function(err){
                                    if(!err) {
                                        //delete each of the checks associated with the user
                                        var userChecks = typeof(data.checks) == 'object' && data.checks instanceof Array ? data.checks : [];
                                        var checksToDelete = userChecks.length;
                                        if(checksToDelete > 0) {
                                            var checksDeleted = 0;
                                            var deletionErrors = false;
                                            userChecks.forEach(function(checkId) {
                                                _data.delete('checks', checkId, function(err) {
                                                    if(err) {
                                                        deletionErrors = true;
                                                    }
                                                    checksDeleted++;
                                                    if(checksDeleted == checksToDelete) {
                                                        if(!deletionErrors) {
                                                            callback(200);
                                                        } else {
                                                            callback(500, {'Error' : 'Errors encountered while attempting to delete all of the users checks. All checks may not have been deleted from the system successfully'});
                                                        }
                                                    }
                                                });
                                            });
                                        } else {
                                            callback(200);
                                        }
                                    } else {
                                        callback(500, {'Error' : 'Could not delete the specified user'});
                                    }
                                })
                            } else {
                                callback(400, {'Error' : 'Could not find the specified user'});
                            }
                        });
                    } else {
                        callback(403, {'Error' : 'Missing required token in header or token is invalid'});
                    }
                });
                
            } else {
                callback(400, {'Error' : 'Missing valid required field'});
            }
        }
    },
    'tokens' : function(data, callback){
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if(acceptableMethods.indexOf(data.method) > -1) {
            handlers._tokens[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    '_tokens' : {
        'post' : function(data, callback) {
            //phone and password
            //creating a token 
            //optional data = none
            var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
            var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

            if(phone && password) {
                //create a token with this password (maybe hashed)
                //lookup the user who matches that phone number
                _data.read('users', phone, function(err, userData){
                    if(!err && userData) {
                        var hashedPassword = helpers.hash(password);
                        if(hashedPassword == userData.hashedPassword) {
                            //continue (create a new token with a random name. set expiration date one hour in the fute);
                            var tokenId = helpers.createRandomString(20);
                            var expires = Date.now() + 1000 * 60 * 60;
                            var tokenObject = {
                                'phone' : phone,
                                'id' : tokenId,
                                'expires' : expires
                            };

                            _data.create('tokens', tokenId, tokenObject, function(err){
                                if(!err) {
                                    callback(200, tokenObject);
                                } else {
                                    callback(500, {'Error' : 'Could not create the new token'});
                                }
                            });

                        } else {
                            callback(400, {'Error' : 'Password did not match the specified user\'s stored password!'});
                        }
                        

                    } else {
                        callback(400, {'Error' : 'Could not find the specified user'});
                    }
                });
            } else {
                callback(400, {'Error' : 'Missing required field(s)'});
            }

        },
        'get' : function(data, callback){
            var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
            if(id) {
                //continue
                _data.read('tokens', id, function(err, tokenData){
                    if(!err && tokenData){
                        //continue
                        //remove the hashed password from the user object before returning it to the requester
                        
                        callback(200, tokenData);
                    } else {
                        callback(404);
                    }
                });
            } else {
                callback(400, {'Error': 'Missing required field'});
            }
        },
        'put' : function(data, callback) {
            var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
            var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;

            if(id && extend) {
                //lookup the token
                _data.read('tokens', id, function(err, tokenData){
                    if(!err && tokenData) {
                        //check to make sure the token isn't already expired
                        if(tokenData.expires > Date.now()) {
                            tokenData.expires +=  Date.now() + 1000 * 60 * 60;
                            //persist into the file system
                            _data.update('tokens', id, tokenData, function(err){
                                if(!err) {
                                    callback(200);
                                } else {
                                    callback(500, {'Error' : 'Could not update the token\'s expiration'});
                                }
                            });
                        } else {
                            callback(400, {'Error' : 'This token has expired and cannot be extended'});
                        } 
                    } else {
                        callback(400, {'Error' : 'Specified token does not exist'});
                    }
                });
            } else {
                callback(400, {'Error' : 'Missing required field(s) or field(s) are invalid'});
            }

        },
        'delete' : function(data, callback){
            var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
            if(id) {
                _data.read('tokens', id, function(err, tokenData){
                    if(!err && tokenData){
                        //delete the data
                        _data.delete('tokens', id, function(err){
                            if(!err) {
                                callback(200);
                            } else {
                                callback(500, {'Error' : 'Could not delete the specified token'});
                            }
                        })
                    } else {
                        callback(400, {'Error' : 'Could not find the specified token'});
                    }
                })
            } else {
                callback(400, {'Error' : 'Missing valid required field'});
            }
        },
        'verifyToken' : function(id, phone, callback){
            //loop up the token
            _data.read('tokens', id, function(err, tokenData){
                if(!err && tokenData) {
                    //check if the token data matches the phone number given
                    if(tokenData.phone == phone && tokenData.expires > Date.now()) {
                        callback(true);
                    } else {
                        callback(false); 
                    }
                } else {
                    callback(false);
                }
            });
        }
    },
    'checks' : function(data, callback){
        var acceptableMethods = ['post', 'get', 'put', 'delete'];
        if(acceptableMethods.indexOf(data.method) > -1) {
            handlers._checks[data.method](data, callback);
        } else {
            callback(405);
        }
    },
    '_checks' : {
        'post' : function(data, callback) {
            //required data, protocal, url, method, succesCodes, timeoutSeconds
            //optional data: none
            //validate all the inputs 
            console.log('hansel and gretle');

            var protocol = typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
            var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
            var method = typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
            var successCodes  = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
            var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
            
            if(protocol && url && method && successCodes && timeoutSeconds) {
                //check that the token has been provided in the header
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

                //loopup the user 
                _data.read('tokens', token, function(err, tokenData){
                    if(!err && tokenData) {
                        console.log('hansel and gre2tle');
                        console.log(tokenData);
                        var userPhone = tokenData.phone;
                        //lookup the user data
                        _data.read('users', userPhone, function(err, userData) {
                            if(!err && userData) {
                                var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                //verify that the user has less than the number of maxchecks per user
                                if(userChecks.length < config.maxChecks) {
                                    //create the new check 
                                    //create a random id for the check 
                                    var checkId = helpers.createRandomString(20);
                                    var checkObject = {
                                        'id' : checkId,
                                        'userPhone' : userPhone,
                                        'protocol' : protocol,
                                        'url' : url,
                                        'method' : method,
                                        'successCodes' : successCodes,
                                        'timeoutSeconds' : timeoutSeconds
                                    };

                                    //save the object to disc
                                    _data.create('checks', checkId, checkObject, function(err){
                                        if(!err) {
                                            //add the check id to the users object 
                                            userData.checks = userChecks;
                                            userData.checks.push(checkId);
                                            
                                            //save the new userData 
                                            _data.update('users', userPhone, userData, function(err) {
                                                if(!err) {
                                                    callback(200, checkObject);
                                                } else {
                                                    callback(500, {'Error' : 'Could not update the user with the new check'});
                                                }
                                            });
                                        } else {
                                            callback(500, {'Error' : 'Could not create the new check'});
                                        }
                                    });
                                } else {
                                    callback(400, {'Error' : 'The user already has the maximum number of checks ('+ config.maxChecks +')'});
                                }


                            } else {
                                callback(500);
                            }
                        });
                    } else {
                        callback(403);
                    }
                });

            } else {
                callback(400, {'Error' : 'Missing required inputs, or inputs are invalid'});
            }

        },
        'get' : function(data, callback){
            var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
            if(id) {
                //lookup the check 
                _data.read('checks', id, function(err, checkData) {
                    if(!err && checkData) {
                        
                        var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
                        //verify that the given token is valid and belongs to the given user that created the check
                        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
                            if(tokenIsValid) {
                                callback(200, checkData);
                            } else {
                                callback(403, {'Error' : 'Missing required token in header or token is invalid'})
                            }
                        });
                    } else {
                        callback(404);
                    }
                });
            } else {
                callback(400, {'Error': 'Missing required field'});
            }
        },
        'put' : function(data, callback){
            //check for the required field 
            
            var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
            
            var protocol = typeof(data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
            var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
            var method = typeof(data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
            var successCodes  = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
            var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
            
            if(id) {
                if(protocol || url || method || successCodes || timeoutSeconds) {
                    
                    _data.read('checks', id, function(err, checkData) {
                        if(!err && checkData) {
                            var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                            handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
                                if(tokenIsValid) {
                                    if(protocol) {
                                        checkData.protocol = protocol;
                                    }
                                    if(url) {
                                        checkData.url = url;
                                    }
                                    if(method) {
                                        checkData.method = method;
                                    }
                                    if(successCodes) {
                                        checkData.successCodes = successCodes;
                                    }
                                    if(timeoutSeconds) {
                                        checkData.timeoutSeconds = timeoutSeconds;
                                    }

                                    //update this 
                                    _data.update('checks', id, checkData, function(err) {
                                        if(!err) {
                                            callback(200);
                                        } else {
                                            callback(500, {'Error' : 'Could not update the check'});
                                        }
                                    });
                                } else {
                                    callback(403);
                                }
                            });
                        } else {
                            callback(400, {'Error' : 'Check ID did not exist'});
                        }
                    });
                } else {
                    callback(400, {'Error' : 'Missing fields to update.'});
                }
            } else {
                callback(400, {'Error' : 'Missing required field'})
            }

        },
        'delete' : function(data, callback) {
            var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
            if(id) {
                //look up the check 
                _data.read('checks', id, function(err, checkData) {
                    if(!err && checkData) {
                        var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
                        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
                            if(tokenIsValid) {
                                //delete the check data
                                _data.delete('checks', id, function(err) {
                                    if(!err) {
                                        _data.read('users', checkData.userPhone, function(err, userData){
                                            if(!err && userData){
                                                var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array && userData.checks.length > 0 ? userData.checks : [];
                                                //remove the deleted check from their list of checks
                                                
                                                var checkPosition = userChecks.indexOf(id);
                                                
                                                if(checkPosition > -1) {
                                                    userChecks.splice(checkPosition, 1);
                                                    //re save the users data
                                                    
                                                    _data.update('users', checkData.userPhone, userData, function(err) {
                                                        if(!err) {
                                                            
                                                        } else {
                                                            callback(500, {'Error' : 'Could not update the user record with updated checks'});
                                                        }
                                                    });
                                                } else {
                                                    callback(500, {'Error' : 'Could not find the check on the users object so could not remove it'});
                                                }
                                            } else {
                                                callback(500, {'Error' : 'Could not find the user who created the check'});
                                            }
                                        });
                                    } else {
                                        callback(500, {'Error' : 'Could not delete the check data'});
                                    }
                                });
                            } else {
                                callback(403);
                            }
                        });                        
                    } else {
                        callback(400, {'Error' : 'The specified check ID does not exist'});
                    }
                });
            } else {
                callback(400, {'Error' : 'Missing valid required field'});
            }
        }
    }

};



module.exports = handlers;
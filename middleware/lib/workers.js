/* worker related tasks */

var path = require('path');
var fs = require('fs');
var _data = require('./data');
var http = require('http');
var https = require('https');
var helpers = require('./helpers');
var url = require('url');
var _logs = require('./logs');


var workers = {};

workers.gatherAllChecks = function() {
    //get all the checks 
    _data.list('checks', function(err, checks) {
        if(!err && checks && checks.length > 0) {
            checks.forEach(function(check) {
                _data.read('checks', check, function(err, originalCheckData) {
                    if(!err && originalCheckData) {
                        //pass the data to the check validator
                        workers.validateCheckData(originalCheckData);
                    } else {
                        console.log('Error reading one of the checks data');
                    }
                });
            });
        } else {
            console.log('Error: Could not find any checks to process');
        }
    });
};

//sanity-check the check data

workers.validateCheckData = function(originalCheckData) {
    originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
    
    originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['https', 'http'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.successCodes  = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

    //set the keys that have not been set if the workers have never seen this before 
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

    if(originalCheckData.id && originalCheckData.userPhone && originalCheckData.protocol && originalCheckData.url && originalCheckData.method && originalCheckData.successCodes && originalCheckData.timeoutSeconds) {
        workers.performCheck(originalCheckData);
    } else {
        console.log('One of the checks is not properly formatted');
    }
            
};

workers.performCheck = function(originalCheckData) {
    //prepare the initial check outcome 
    var checkOutcome = {
        'error' : false,
        'responseCode' : false,
    };

    //mark that the outcome has not been sent yet
    var outcomeSent = false;
    
    //parse the hostname and the path from the 
    var parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
    var hostName = parsedUrl.hostname;
    var path = parsedUrl.path;

    //construct the request 
    var requestDetails = {
        'protocol' : originalCheckData.protocol +':',
        'hostname' : hostName,
        'method' : originalCheckData.method.toUpperCase(),
        'path' : path,
        'timeout' : originalCheckData.timeoutSeconds * 1000
    };

    //instantiate a request object
    var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
    var req = _moduleToUse.request(requestDetails, function(res) {
        //grab the status of the sent request
        
        var status = res.statusCode;

        //update the check outcome and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent) {
            workers.processCheckOut(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    //bind to the error event so it doesnt get thrown 
    req.on('error', function(e) {
        checkOutcome.error = {
            'error' : true,
            'value' : e
        };

        if(!outcomeSent) {
            workers.processCheckOut(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    req.on('timeout', function(e) {
        checkOutcome.error = {
            'error' : true,
            'value' : 'timeout'
        };

        if(!outcomeSent) {
            workers.processCheckOut(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    req.end();
    
};
workers.processCheckOut = function(originalCheckData, checkOutcome) {
    console.log(checkOutcome.responseCode);
    var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';
    
    //decide if an alert is warrented 
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    //log the outcome
    var timeOfCheck = Date.now();
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);


    //update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    
    

    //save the updates to disc
    _data.update('checks', newCheckData.id, newCheckData, function(err) {
        if(!err) {
            //send the new check data to the next phase in the process if needed
            if(alertWarranted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                console.log('Check outcome has not changed, no alert needed');
            }

        } else {
            console.log('trying to save updates to one of the checks');
        }
    }); 

};

workers.alertUserToStatusChange = function(newCheckData) {
    var msg = 'Alert, your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol + '://' + newCheckData.url + ' is currently ' + newCheckData.state;
    helpers.sendTwilioSMS(newCheckData.userPhone, msg, function(err) {
        if(!err) {
            console.log('success: user was alerted to a status change in their check via sms');
            console.log(msg);
        } else {
            console.log('could not send sms alert to user who had a state change in their check');
        }
    });
};

workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {

    var logData = {
        'check' : originalCheckData,
        'outcome' : checkOutcome,
        'state' : state,
        'alert' : alertWarranted,
        'time' : timeOfCheck
    };

    var logString = JSON.stringify(logData);
    var logFileName = originalCheckData.id;
    //append the log string to the file 
    _logs.append(logFileName, logString, function(err) {
        if(!err) {
            console.log('Logging to file succeeded');
        } else {
            console.log('Logging to file failed');
        }
    });
};


//timer to execute the worker-process once per minute 
workers.loop = function() {
    setInterval(function() {
        workers.gatherAllChecks();
    }, 1000 * 60);
};

workers.rotateLogs = function() {
    //listing all the non compressed log files
    _logs.list(false, function(err, logs) {
        if(!err && logs && logs.length > 0) {
            logs.forEach(function(logName) {
                //compress the data to a different file 
                var logId = logName.replace('.log', '');
                var newFileId = logId + '-' + Date.now();
                _logs.compress(logId, newFileId, function(err) {
                    if(!err) {
                        //truncate the log
                        //(empty the log)
                        _logs.truncate(logId, function(err) {
                            if(!err) {
                                console.log('Success truncating logFile');
                            } else {
                                console.log('Error truncating the log file');
                            }
                        });
                    } else {
                        console.log('Error compressing one of the log files', err);
                    }
                });
            });
        } else {
            console.log('Error, could not find any logs to rotate');
        }
    });
};

workers.logRotationLoop = function() {
    setInterval(function() {
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
};

workers.init = function() {

    workers.gatherAllChecks();

    workers.loop();

    //compress all the logs immediately
    workers.rotateLogs();

    //call the compression loop so logs will be compressed later on 

    workers.logRotationLoop();
};


module.exports = workers;
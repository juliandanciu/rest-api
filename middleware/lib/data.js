/*
 * Library used for storing and editing data 
 * 
 */

//Dependencies 
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');

//container for the module (to be exported)
var lib = {};
lib.baseDir = path.join(__dirname, '/../.data/');
lib.create = function(dir, file, data, callback){
    //open the file for writing 
    fs.open(lib.baseDir + dir + '/' + file+ '.json', 'wx', function(err, fileDescriptor){
        if(!err && fileDescriptor){
            //convert data to string
            var stringData = JSON.stringify(data);

            //write to file and close it
            fs.writeFile(fileDescriptor, stringData, function(err){
                if(!err){
                    fs.close(fileDescriptor, function(err){
                        if(!err){
                            callback(false);
                        } else {
                            callback('Error closing the file');
                        }
                    })
                } else {
                    callback('Error writing to new file');
                }
            });
        } else {
            callback('Could not create new file, it may already exist');
        }
    });
};

lib.read = function(dir, file, callback){
    
    fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf8', function(err, data){
        if (!err && data) {
            var parsedData = helpers.parseJSONToObject(data);
            callback(false, parsedData);
        } else {
            callback(err, data);
        }
    })
};

lib.update = function(dir, file, data, callback){
    fs.open(lib.baseDir + dir + '/' + file+ '.json', 'r+', function(err, fileDescriptor){
        if(!err && fileDescriptor){
            var stringData = JSON.stringify(data);
            fs.truncate(fileDescriptor, function(err){
                if(!err){
                    fs.writeFile(fileDescriptor, stringData, function(err){
                        if(!err){
                            fs.close(fileDescriptor, function(err){
                                if(!err){
                                    callback(false);
                                } else {
                                    callback('Error closing the file.');
                                }
                            });
                        } else{
                            callback('Error writing to existing file.');
                        }
                    });
                } else {
                    callback('Error truncating the file');
                }
            });
        } else{
            callback('Could not open file for updating; it may not exist yet.');
        }
    });
};

lib.delete = function(dir, file, callback){
    fs.unlink(lib.baseDir+dir+'/'+file+'.json', function(err){
        if(!err){
            callback(false);
        } else{
            callback(err);
        }
    })
};

//list all the items in a directory
lib.list = function(dir, callback) {
    fs.readdir(lib.baseDir + dir + '/', function(err, data) {
        if(!err && data && data.length > 0) {
            var trimmedFileNames = [];
            data.forEach(function(fileName) {
                trimmedFileNames.push(fileName.replace('.json', ''));
            });
            callback(false, trimmedFileNames);
        } else {
            callback(err, data);
        }
    });
};

//export the module
module.exports = lib;
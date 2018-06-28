/* this is library for storing and rotating logs  */

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');


var lib = {};

lib.baseDir = path.join(__dirname, '/../.logs/');

//append a string to a file. create the file if it does not exist 
lib.append = function(file, str, callback) {
    //opening the file for appends
    console.log(lib.baseDir, file);
    fs.open(lib.baseDir+file+'.log', 'a', function(err, fileDescriptor) {
        if(!err && fileDescriptor) {
            fs.appendFile(fileDescriptor, str + '\n', function(err) {
                if(!err) {
                    fs.close(fileDescriptor, function(err) {
                        callback(false);
                    });
                } else {
                    callback('Error appending to file');
                }
            });
        } else {
            callback('Could not open file for appending');
        }
    })
};









module.exports = lib;

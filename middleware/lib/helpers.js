/* helpers for various tasks needed in the REST API  */


/* dependencies */
var crypto = require('crypto');
var config = require('./config');
var https = require('https');
var querystring = require('querystring');
/* container */

var helpers = {
    'hash' : function(str){
        if(typeof(str) == 'string' && str.length > 0){
            var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
            return hash;

        } else {
            return false;
        }
        
    },
    'parseJSONToObject' : function(str) {
        try{
            var obj = JSON.parse(str);
            return obj;
        } catch(e) {
            return {};
        }
    },
    'createRandomString' : function(strLength) {
        strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
        if(strLength) {
            //Define all the possible characters that can go into the string
            var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
            var possibleCharactersLength = possibleCharacters.length;
            var str = '';
            for(i = 1; i <= strLength; i++) {
                //get a random character from the possible characters string
                var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharactersLength));
                //append this character to the final string
                str += randomCharacter;
            }

            return str;

        } else {
            return false;
        }
    },
    'sendTwilioSMS' : function(phone, msg, callback) {
        phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
        msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;
        if(phone && msg) {
            var payload = {
                'From' : config.twilio.fromPhone,
                'To' : '+1' + phone,
                'Body' : msg
            };

            var stringPayload = querystring.stringify(payload);

            var requestDetails = {
                'protocol' : 'https:',
                'hostname' : 'api.twilio.com',
                'method' : 'POST',
                'path' : '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
                'auth' : config.twilio.accountSid + ':' + config.twilio.authToken,
                'headers' : {
                    'Content-Type' : 'application/x-www-form-urlencoded',
                    'Content-Length' : Buffer.byteLength(stringPayload)
                }
            };

            //instantiate the request object
            var req = https.request(requestDetails, function(res) {
                var status = res.statusCode;
                if(status == 200 || status == 201) {
                    callback(false);
                } else {
                    callback('Status Code returned was ' + status);
                }
            });

            //bind to the error event so it doesnt get thrown
            req.on('error', function(e){
                callback(e);
            });

            req.write(stringPayload);

            req.end();

        } else {
            callback('Invalid arguments');
        }
    }
};




module.exports = helpers;
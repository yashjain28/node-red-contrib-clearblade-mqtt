var mqtt = require("mqtt");
// Support for MQTT Auth to be added later
// function ClearBladeMQTTAuth(clearbladeOptions) {
//     var options = {
//         query:{}
//     };
//     console.log("*********** Doing MQTT AUTH ************");
//     options.query.clientId = clearbladeOptions.username+":"+clearbladeOptions.password;
//     options.username = clearbladeOptions.systemKey;
//     options.password = clearbladeOptions.systemSecret;
//     options.protocol = "mqtt";

//     var client = mqtt.connect( clearbladeOptions.broker, options);
//     client.on("connect", function() {
//         console.log("---Connected:");
//           client.subscribe("Auth", {
//               "qos":0
//           });
//     });
//     client.on('message', function(topic, message){
//         console.log(message.toString());
//         if(topic === "Auth"){
//             clearbladeOptions.callback(false, message.toJSON());
//         }
//         else{
//             clearbladeOptions.callback(true, message.toJSON());
//         }
//         client.end();
//     });
// }
function ClearBladeAuth() {
  var Q = require("q");
  var ClearBlade = require("clearblade");
  var _options = {};
  function Authenticate(options) {
    _options = Object.assign(options);
    if (!options.URI) {
      options.URI = "https://" + options.messagingURI;
    }
    var deferred = Q.defer();
    options.callback = function(err, data) {
      if (err) {
        deferred.reject(data);
      } else {
        deferred.resolve(data);
      }
    };
    ClearBlade.init(options);
    return deferred.promise;
  }

  function CheckAuth(authToken, callback) {
    const uri = "https://" + _options.messagingURI + "/api/v/1/user/checkauth";
    requestOptions = {
      url: uri,
      method: "POST",
      headers: {
        "ClearBlade-UserToken": authToken,
        "ClearBlade-SystemKey": _options.systemKey
      }
    };
     var deferred = Q.defer();
    request(requestOptions, function(error, response, body) {
      if (error) {
        deferred.reject(error);
      }
      else{
        deferred.resolve(body);
      }
    });
    return deferred.promise;
  }
  return {
    CheckAuth,
    Authenticate
  };
}

module.exports = ClearBladeAuth;

var mqtt = require("mqtt");

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
function ClearBladeAuth(options){
    var ClearBlade = require("clearblade");
    if(!options.URI){
        options.URI = "https://" + options.messagingURI;
    }
    ClearBlade.init(options);
}


module.exports = ClearBladeAuth;

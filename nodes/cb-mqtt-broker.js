/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
  "use strict";
  var mqtt = require("mqtt");
  var util = require("util");
  var isUtf8 = require("is-utf8");
  var HttpsProxyAgent = require("https-proxy-agent");
  var url = require("url");
  var cb = require("clearblade");
  
  var ClearBladeAuth = require("./ClearBladeAuth");
  
  function matchTopic(ts, t) {
    if (ts == "#") {
      return true;
    } else if (ts.startsWith("$share")) {
    /* The following allows shared subscriptions (as in MQTT v5)
           http://docs.oasis-open.org/mqtt/mqtt/v5.0/cs02/mqtt-v5.0-cs02.html#_Toc514345522
           
           4.8.2 describes shares like:
           $share/{ShareName}/{filter}
           $share is a literal string that marks the Topic Filter as being a Shared Subscription Topic Filter.
           {ShareName} is a character string that does not include "/", "+" or "#"
           {filter} The remainder of the string has the same syntax and semantics as a Topic Filter in a non-shared subscription. Refer to section 4.7.
        */
      ts = ts.replace(/^\$share\/[^#+/]+\/(.*)/g, "$1");
    }
    var re = new RegExp(
      "^" +
        ts
          .replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, "\\$1")
          .replace(/\+/g, "[^/]+")
          .replace(/\/#$/, "(/.*)?") +
        "$"
    );
    return re.test(t);
  }

  function MQTTBrokerNode(n) {
    RED.nodes.createNode(this, n);

    // Configuration options passed by Node Red
    this.broker = n.broker;
    this.port = n.port;
    this.clientid = n.clientid;
    this.usetls = n.usetls;
    this.usews = n.usews;
    this.verifyservercert = n.verifyservercert;
    this.compatmode = n.compatmode;
    this.keepalive = n.keepalive;
    this.cleansession = n.cleansession;
    this.reconnectPeriod = n.reconnectperiod;

    this.ClearBladeAuth = ClearBladeAuth;
    this.clearbladesystemkey = n.clearbladesystemkey;
    this.clearbladesystemsecret = n.clearbladesystemsecret;
    this.clearbladeuser = n.clearbladeuser;
    this.clearbladepassword = n.clearbladepassword;
    this.clearbladeplatformurl = n.clearbladeplatformurl;
    // Config node state
    this.brokerurl = "";
    this.connected = false;
    this.connecting = false;
    this.closing = false;
    this.options = {};
    this.queue = [];
    this.subscriptions = {};

    if (n.birthTopic) {
      this.birthMessage = {
        topic: n.birthTopic,
        payload: n.birthPayload || "",
        qos: Number(n.birthQos || 0),
        retain: n.birthRetain == "true" || n.birthRetain === true
      };
    }

    if (n.closeTopic) {
      this.closeMessage = {
        topic: n.closeTopic,
        payload: n.closePayload || "",
        qos: Number(n.closeQos || 0),
        retain: n.closeRetain == "true" || n.closeRetain === true
      };
    }
    if (this.credentials) {
      this.username = this.credentials.user;
      this.password = this.credentials.password;
    }

    // If the config node is missing certain options (it was probably deployed prior to an update to the node code),
    // select/generate sensible options for the new fields
    if (typeof this.usetls === "undefined") {
      this.usetls = false;
    }
    if (typeof this.usews === "undefined") {
      this.usews = false;
    }
    if (typeof this.compatmode === "undefined") {
      this.compatmode = true;
    }
    if (typeof this.verifyservercert === "undefined") {
      this.verifyservercert = false;
    }
    if (typeof this.keepalive === "undefined") {
      this.keepalive = 60;
    } else if (typeof this.keepalive === "string") {
      this.keepalive = Number(this.keepalive);
    }
    if (typeof this.cleansession === "undefined") {
      this.cleansession = true;
    }
    var prox;
    if (process.env.http_proxy != null) {
      prox = process.env.http_proxy;
    }
    if (process.env.HTTP_PROXY != null) {
      prox = process.env.HTTP_PROXY;
    }

    // Create the URL to pass in to the MQTT.js library
    if (this.brokerurl === "") {
      // if the broker may be ws:// or wss:// or even tcp://
      if (this.broker.indexOf("://") > -1) {
        this.brokerurl = this.broker;
        // Only for ws or wss, check if proxy env var for additional configuration
        if (
          this.brokerurl.indexOf("wss://") > -1 ||
          this.brokerurl.indexOf("ws://") > -1
        )
          if (prox) {
            // check if proxy is set in env
            var parsedUrl = url.parse(this.brokerurl);
            var proxyOpts = url.parse(prox);
            // true for wss
            proxyOpts.secureEndpoint = parsedUrl.protocol
              ? parsedUrl.protocol === "wss:"
              : true;
            // Set Agent for wsOption in MQTT
            var agent = new HttpsProxyAgent(proxyOpts);
            this.options.wsOptions = {
              agent: agent
            };
          }
      } else {
        // construct the std mqtt:// url
        if (this.usetls) {
          this.brokerurl = "mqtts://";
        } else {
          this.brokerurl = "mqtt://";
        }
        if (this.broker !== "") {
          this.brokerurl = this.brokerurl + this.broker + ":";
          // port now defaults to 1883 if unset.
          if (!this.port) {
            this.brokerurl = this.brokerurl + "1883";
          } else {
            this.brokerurl = this.brokerurl + this.port;
          }
        } else {
          this.brokerurl = this.brokerurl + "localhost:1883";
        }
      }
    }

    if (!this.cleansession && !this.clientid) {
      this.cleansession = true;
      this.warn(RED._("mqtt.errors.nonclean-missingclientid"));
    }

    // Build options for passing to the MQTT.js API
    this.options.clientId =
      this.clientid || "mqtt_" + (1 + Math.random() * 4294967295).toString(16);
    this.options.username = this.username;
    this.options.password = this.password;
    this.options.keepalive = this.keepalive;
    this.options.clean = this.cleansession;
    this.options.reconnectPeriod = this.reconnectPeriod || 1000;
    if (this.compatmode == "true" || this.compatmode === true) {
      this.options.protocolId = "MQIsdp";
      this.options.protocolVersion = 3;
    }
    if (this.usetls && n.tls) {
      var tlsNode = RED.nodes.getNode(n.tls);
      if (tlsNode) {
        tlsNode.addTLSOptions(this.options);
      }
    }
   
    // If there's no rejectUnauthorized already, then this could be an
    // old config where this option was provided on the broker node and
    // not the tls node
    if (typeof this.options.rejectUnauthorized === "undefined") {
      this.options.rejectUnauthorized =
        this.verifyservercert == "true" || this.verifyservercert === true;
    }

    if (n.willTopic) {
      this.options.will = {
        topic: n.willTopic,
        payload: n.willPayload || "",
        qos: Number(n.willQos || 0),
        retain: n.willRetain == "true" || n.willRetain === true
      };
    }

    // Define functions called by MQTT in and out nodes
    var node = this;
    this.users = {};
    function setClearBladeOptions(){
      var options = {};
      options.systemKey =  node.clearbladesystemkey;
      options.systemSecret = node.clearbladesystemsecret;
      options.email = node.clearbladeuser;
      options.password =node.clearbladepassword;
      options.messagingURI = node.broker;
      options.messagingPort = node.port;
      options.URI = node.clearbladeplatformurl;
      return options;
    }

    this.register = function(mqttNode) {
      node.users[mqttNode.id] = mqttNode;
      if (Object.keys(node.users).length === 1) {
        var clearbladeOptions = setClearBladeOptions();
        clearbladeOptions.callback = function(err, data){
            if(err){
              console.log("-----ERROR Authenticating to CLEARBLADE-------")
              console.log(err, data);
              node.error("Clearblade Auth Failed: "+ data);
              // In case user name and password are passed in the Security Section
              node.connect();
            }
            else{
              node.options.username = data.authToken;
              node.options.password = clearbladeOptions.systemKey;
              node.connect();
            }
        }
        node.ClearBladeAuth(clearbladeOptions);
      }
    };

    this.deregister = function(mqttNode, done) {
      delete node.users[mqttNode.id];
      if (node.closing) {
        return done();
      }
      if (Object.keys(node.users).length === 0) {
        if (node.client && node.client.connected) {
          return node.client.end(done);
        } else {
          node.client.end();
          return done();
        }
      }
      done();
    };

    this.connect = function() {
      if (!node.connected && !node.connecting) {
        node.connecting = true;
        try {
          node.client = mqtt.connect(
            node.brokerurl,
            node.options
          );
          node.client.setMaxListeners(0);
          // Register successful connect or reconnect handler
          node.client.on("connect", function() {
            node.connecting = false;
            node.connected = true;
            node.log(
              RED._("mqtt.state.connected", {
                broker:
                  (node.clientid ? node.clientid + "@" : "") + node.brokerurl
              })
            );
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({
                  fill: "green",
                  shape: "dot",
                  text: "node-red:common.status.connected"
                });
              }
            }
            // Remove any existing listeners before resubscribing to avoid duplicates in the event of a re-connection
            node.client.removeAllListeners("message");

            // Re-subscribe to stored topics
            for (var s in node.subscriptions) {
              if (node.subscriptions.hasOwnProperty(s)) {
                var topic = s;
                var qos = 0;
                for (var r in node.subscriptions[s]) {
                  if (node.subscriptions[s].hasOwnProperty(r)) {
                    qos = Math.max(qos, node.subscriptions[s][r].qos);
                    node.client.on("message", node.subscriptions[s][r].handler);
                  }
                }
                var options = { qos: qos };
                node.client.subscribe(topic, options);
              }
            }

            // Send any birth message
            if (node.birthMessage) {
              node.publish(node.birthMessage);
            }
          });
          node.client.on("reconnect", function() {
            for (var id in node.users) {
              if (node.users.hasOwnProperty(id)) {
                node.users[id].status({
                  fill: "yellow",
                  shape: "ring",
                  text: "node-red:common.status.connecting"
                });
              }
            }
          });
          // Register disconnect handlers
          node.client.on("close", function() {
            if (node.connected) {
              node.connected = false;
              node.log(
                RED._("mqtt.state.disconnected", {
                  broker:
                    (node.clientid ? node.clientid + "@" : "") + node.brokerurl
                })
              );
              for (var id in node.users) {
                if (node.users.hasOwnProperty(id)) {
                  node.users[id].status({
                    fill: "red",
                    shape: "ring",
                    text: "node-red:common.status.disconnected"
                  });
                }
              }
            } else if (node.connecting) {
              node.log(
                RED._("mqtt.state.connect-failed", {
                  broker:
                    (node.clientid ? node.clientid + "@" : "") + node.brokerurl
                })
              );
            }
          });

          // Register connect error handler
          // The client's own reconnect logic will take care of errors
          node.client.on("error", function(error) {});
        } catch (err) {
          console.log(err);
        }
      }
    };

    this.subscribe = function(topic, qos, callback, ref) {
      ref = ref || 0;
      node.subscriptions[topic] = node.subscriptions[topic] || {};
      var sub = {
        topic: topic,
        qos: qos,
        handler: function(mtopic, mpayload, mpacket) {
          if (matchTopic(topic, mtopic)) {
            callback(mtopic, mpayload, mpacket);
          }
        },
        ref: ref
      };
      node.subscriptions[topic][ref] = sub;
      if (node.connected) {
        node.client.on("message", sub.handler);
        var options = {};
        options.qos = qos;
        node.client.subscribe(topic, options);
      }
    };

    this.unsubscribe = function(topic, ref) {
      ref = ref || 0;
      var sub = node.subscriptions[topic];
      if (sub) {
        if (sub[ref]) {
          node.client.removeListener("message", sub[ref].handler);
          delete sub[ref];
        }
        if (Object.keys(sub).length === 0) {
          delete node.subscriptions[topic];
          if (node.connected) {
            node.client.unsubscribe(topic);
          }
        }
      }
    };

    this.publish = function(msg) {
      if (node.connected) {
        if (msg.payload === null || msg.payload === undefined) {
          msg.payload = "";
        } else if (!Buffer.isBuffer(msg.payload)) {
          if (typeof msg.payload === "object") {
            msg.payload = JSON.stringify(msg.payload);
          } else if (typeof msg.payload !== "string") {
            msg.payload = "" + msg.payload;
          }
        }

        var options = {
          qos: msg.qos || 0,
          retain: msg.retain || false
        };
        node.client.publish(msg.topic, msg.payload, options, function(err) {
          return;
        });
      }
    };

    this.on("close", function(done) {
      this.closing = true;
      if (this.connected) {
        // Send close message
        if (node.closeMessage) {
          node.publish(node.closeMessage);
        }
        this.client.once("close", function() {
          done();
        });
        this.client.end();
      } else if (this.connecting || node.client.reconnecting) {
        node.client.end();
        done();
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType("cb-mqtt-broker", MQTTBrokerNode, {
    credentials: {
      user: { type: "text" },
      password: { type: "password" }
    }
  });
};
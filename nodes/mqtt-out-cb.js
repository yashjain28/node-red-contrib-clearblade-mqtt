 module.exports = function (RED) {
    'use strict';
    const isUtf8 = require('is-utf8');

 function MQTTOutNode(n) {
    RED.nodes.createNode(this, n);
    this.topic = n.topic;
    this.qos = n.qos || null;
    this.retain = n.retain;
    this.broker = n.broker;
    this.brokerConn = RED.nodes.getNode(this.broker);
    var node = this;

    if (this.brokerConn) {
      this.status({
        fill: "red",
        shape: "ring",
        text: "node-red:common.status.disconnected"
      });
      this.on("input", function(msg) {
        if (msg.qos) {
          msg.qos = parseInt(msg.qos);
          if (msg.qos !== 0 && msg.qos !== 1 && msg.qos !== 2) {
            msg.qos = null;
          }
        }
        msg.qos = Number(node.qos || msg.qos || 0);
        msg.retain = node.retain || msg.retain || false;
        msg.retain = msg.retain === true || msg.retain === "true" || false;
        if (node.topic) {
          msg.topic = node.topic;
        }
        if (msg.hasOwnProperty("payload")) {
          if (
            msg.hasOwnProperty("topic") &&
            typeof msg.topic === "string" &&
            msg.topic !== ""
          ) {
            // topic must exist
            this.brokerConn.publish(msg); // send the message
          } else {
            node.warn(RED._("mqtt.errors.invalid-topic"));
          }
        }
      });
      if (this.brokerConn.connected) {
        node.status({
          fill: "green",
          shape: "dot",
          text: "node-red:common.status.connected"
        });
      }
      node.brokerConn.register(node);
      this.on("close", function(done) {
        node.brokerConn.deregister(node, done);
      });
    } else {
      this.error(RED._("mqtt.errors.missing-config"));
    }
  }
  RED.nodes.registerType("mqtt out cb", MQTTOutNode);
 }
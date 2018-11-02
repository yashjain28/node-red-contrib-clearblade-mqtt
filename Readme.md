## ClearBlade MQTT Connection for Node-Red

### Setup
1. Use, a 'mqtt in cb' for subscribing and 'mqtt out cb' for publishing to ClearBlade.
2. In any node, add/edit a cb-mqtt-broker-config node.
3. Enter the ClearBlade SystemKey, SystemSecret, Username(Email), Password, & Platform and Messaging(Broker) Url.
4. This information will be used to dynamically authenticate user to the platform (using https, auth using mqtt will be added in the future).
5. Once Config is done, hit Deploy.


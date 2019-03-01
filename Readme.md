## ClearBlade MQTT Connection for Node-Red

### Setup
1. Use, a 'mqtt in cb' for subscribing and 'mqtt out cb' for publishing to ClearBlade.
2. Steps to Perform on ClearBlade Platform (https://platform.clearblade.com):
    * Create a 'System' on the clearblade platform. 
    * Create a 'User; in the user section of the console, it has default 'Authenticated Role'. (the credentials entered here, will be used as `ClearBlade Username` & `ClearBlade Password` when filling out the Broker Client Config)
    * On the Roles page of the Console, Select the 'Authenticated' Role (or any other role which the user is allocated), go to the "Message Topics" section and set the permission for topic names for that role, hit 'Save and Exit'.
    * Note down ClearBlade System Key & System Secret from the info tab in the Console.
3. In any node(mqtt in/out cb), add/edit a 'cb mqtt broker config node'.
4. Enter the following details in the Broker Client Config:

    * ClearBlade SystemKey: c6c1b0bb6a7a685a9d3ecf0f001
    * ClearBlade SystemSecret: C6C1E6CECE6BFD495F8B3A001
    * ClearBlade Username(Email): yourname@emailservice.com
    * ClearBlade Password: yourpassword
    * ClearBlade PlatformUrl: https://platform.clearblade.com
    * Server (Messaging/Broker Url): platform.clearblade.com
    * Port: 1884
    * Enable tls: check box
    * ClientId: UniqueClientId

    This information will be used to dynamically authenticate user to the platform (using https, auth using mqtt will be added in the future). For more details about mqtt at ClearBlade refer: https://docs.clearblade.com/v/3/4-developer_reference/MQTT/

5. For non-tls, set the port as 1883, to use tls, just select the tls checkbox and use port 1884.
6. For sending data to the `edge`, the following parameters might need some update:
    - Server/Broker URL: \<ip-address-of-the-edge>
    - ClearBlade PlatformUrl: http://\<ip-address-of-the-edge>:9000 
6. Once Config is done, set the topics, qos and other details as per requirement in the 'mqtt in/out cb' nodes, which is similar to Node-Red's core MQTT nodes. 
7. Finally, hit deploy.



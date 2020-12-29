/*
 * node-red-contrib-gira-rest
 * Copyright (C) 2020 Fabian Schmieder
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 'use strict';
 */

'use strict';
var gira_rest_api = require('./lib/gira-rest-api.js');

module.exports = function (RED) {
    function GiraHost(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.hosturl = config.hosturl;
        node.clientid = config.clientid;
        node.callbackurl = config.callbackurl;
        node.callbackpath_service = '/node-red-contrib-gira-rest/' + node.id + '/service';
        node.callbackpath_value = '/node-red-contrib-gira-rest/' + node.id + '/value';

        // node state
        node.token = '';
        node.hostavailable = false;
        node.callback_registered = false;
        node.uiconfig = {};

        // node event clients
        node.nodeClients = [];

        // HTTP endpoint for service callback functions
        RED.httpAdmin.post(node.callbackpath_service, function (req, res) {
            var nodeId = req.params.nodeId;
            if (req.body && req.body.token && req.body.token == node.token) {
                res.send(200).end();

                // if uiConfig has changed, update the configuration of the node
                if (req.body.event == 'uiConfigChanged') {
                    node.getUIconfig();
                }

                //if (req.body.events.length > 0) {
                node.nodeClients.forEach(stack => {
                    stack.queueEvent(req.body);
                });
                //}
            }
            else {
                res.send(401).end();
            }
        });

        // HTTP endpoint for value callback functions
        RED.httpAdmin.post(node.callbackpath_value, function (req, res) {
            var nodeId = req.params.nodeId;
            if (req.body && req.body.token && req.body.token == node.token) {
                res.send(200).end();

                if (req.body.events.length > 0) {
                    node.nodeClients.forEach(stack => {
                        stack.queueEvent(req.body);
                    });
                }
            }
            else {
                res.send(401).end();
            }
        });

        // Functions

        // Register client with Gira API
        node.registerClient = () => {
            var client;
            client = new gira_rest_api.GiraRestApi({ domain: this.hosturl, username: this.credentials.username, password: this.credentials.password });

            var result;
            var parameters = { 'body': { 'client': this.clientid } };
            result = client.GiraAPI_RegisterClient(parameters);

            var setData = function (msg, data) {
                if (data) {
                    if (data.response) {
                        if (data.response.statusCode) {
                            msg.statusCode = data.response.statusCode;
                        }
                        if (data.response.headers) {
                            msg.headers = data.response.headers;
                        }
                        if (data.response.request && data.response.request.uri && data.response.request.uri.href) {
                            msg.responseUrl = data.response.request.uri.href;
                        }
                    }
                    if (data.body) {
                        msg.payload = data.body;
                    }
                }
                return msg;
            };

            result.then(function (data) {
                if (data.body.token) {
                    node.token = data.body.token;
                    node.hostavailable = true;
                }
                else {
                    node.token = '';
                    node.hostavailable = false;
                    // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                    node.error("Registration with Gira API failed; no valid 'token' in response.");
                }
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = "Gira API: " + error.body.error.message;
                }
                else if (error && error.body && error.body.message) {
                    message = error.body.message;
                }
                node.token = '';
                node.hostavailable = false;
                // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                node.error(message);
            });
            return;
        }

        // Unregister client with Gira API
        node.unregisterClient = () => {
            var client;
            client = new gira_rest_api.GiraRestApi({ domain: this.hosturl });

            var result;
            var parameters = { 'token': node.token + "1" };
            result = client.GiraAPI_UnregisterClient(parameters);

            var setData = function (msg, data) {
                if (data) {
                    if (data.response) {
                        if (data.response.statusCode) {
                            msg.statusCode = data.response.statusCode;
                        }
                        if (data.response.headers) {
                            msg.headers = data.response.headers;
                        }
                        if (data.response.request && data.response.request.uri && data.response.request.uri.href) {
                            msg.responseUrl = data.response.request.uri.href;
                        }
                    }
                    if (data.body) {
                        msg.payload = data.body;
                    }
                }
                return msg;
            };

            result.then(function (data) {
                // console.log("unregister client");
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = "Gira API: " + error.body.error.message;
                }
                else if (error && error.body && error.body.message) {
                    message = error.body.message;
                }
                node.token = '';
                node.hostavailable = false;
                // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                node.error(message);
            });
            return;
        }

        // Check if host is available
        node.checkHostAvailable = () => {
            if (!node.hostavailable) {
                node.registerClient();
            }
            return node.hostavailable;
        }

        // Unregister Callback functions for event handling
        node.unregisterCallbacks = () => {
            var client;
            client = new gira_rest_api.GiraRestApi({ domain: this.hosturl });

            var result;
            var parameters = { 'token': node.token };
            result = client.GiraAPI_UnregisterCallbacks(parameters);

            var setData = function (msg, data) {
                if (data) {
                    if (data.response) {
                        if (data.response.statusCode) {
                            msg.statusCode = data.response.statusCode;
                        }
                        if (data.response.headers) {
                            msg.headers = data.response.headers;
                        }
                        if (data.response.request && data.response.request.uri && data.response.request.uri.href) {
                            msg.responseUrl = data.response.request.uri.href;
                        }
                    }
                    if (data.body) {
                        msg.payload = data.body;
                    }
                }
                return msg;
            };

            result.then(function (data) {
                // console.log("unregister callbacks");
                node.callback_registered = false;
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = "Gira API: " + error.body.error.message;
                }
                else if (error && error.body && error.body.message) {
                    message = error.body.message;
                }
                // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                node.error(message);
            });
            return;
        }

        // Register Callback functions for event handling
        node.registerCallbacks = () => {
            if (node.callbackurl) {
                const serviceCallback = new URL(node.callbackpath_service, node.callbackurl).href;
                const valueCallback = new URL(node.callbackpath_value, node.callbackurl).href;

                var client;
                client = new gira_rest_api.GiraRestApi({ domain: this.hosturl });

                var result;
                var parameters = {
                    'token': node.token,
                    'body': {
                        "serviceCallback": serviceCallback,
                        "valueCallback": valueCallback,
                        "testCallbacks": true
                    }
                };

                result = client.GiraAPI_RegisterCallbacks(parameters);

                var setData = function (msg, data) {
                    if (data) {
                        if (data.response) {
                            if (data.response.statusCode) {
                                msg.statusCode = data.response.statusCode;
                            }
                            if (data.response.headers) {
                                msg.headers = data.response.headers;
                            }
                            if (data.response.request && data.response.request.uri && data.response.request.uri.href) {
                                msg.responseUrl = data.response.request.uri.href;
                            }
                        }
                        if (data.body) {
                            msg.payload = data.body;
                        }
                    }
                    return msg;
                };

                result.then(function (data) {
                    // console.log("register callbacks");
                    node.callback_registered = true;
                }).catch(function (error) {
                    var message = null;
                    if (error && error.body && error.body.error && error.body.error.message) {
                        message = "Gira API: " + error.body.error.message;
                    }
                    else if (error && error.body && error.body.message) {
                        message = error.body.message;
                    }
                    // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                    node.error(message);
                });
            }
            else {
                done('Callback URL not set.');
            }
            return;
        }

        // Register Callback functions for event handling
        node.getUIconfig = () => {
            var client;
            client = new gira_rest_api.GiraRestApi({ domain: this.hosturl });

            var result;
            var parameters = {
                'token': node.token
            };

            result = client.GiraAPI_GetUIconfig(parameters);

            var setData = function (msg, data) {
                if (data) {
                    if (data.response) {
                        if (data.response.statusCode) {
                            msg.statusCode = data.response.statusCode;
                        }
                        if (data.response.headers) {
                            msg.headers = data.response.headers;
                        }
                        if (data.response.request && data.response.request.uri && data.response.request.uri.href) {
                            msg.responseUrl = data.response.request.uri.href;
                        }
                    }
                    if (data.body) {
                        msg.payload = data.body;
                    }
                }
                return msg;
            };

            result.then(function (data) {
                // console.log(data);
                node.uiconfig = data;
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = "Gira API: " + error.body.error.message;
                }
                else if (error && error.body && error.body.message) {
                    message = error.body.message;
                }
                // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                node.error(message);
            });

            return;
        }

        // Add Gira Event Node to the array of clients
        node.addClient = (_Node) => {
            // Check if node already exists
            if (node.nodeClients.filter(x => x.id === _Node.id).length === 0) {
                // Add _Node to the clients array
                node.nodeClients.push(_Node);
            }
            // At first node client connection, this node needs to register the callback functions
            if (node.nodeClients.length === 1) {
                try {
                    if (node.checkHostAvailable()) {
                        node.registerCallbacks();
                    }

                } catch (error) {
                    done("Callback function couldn't be successfully registered with Gira API.");
                }
            }
        }

        // Remove Gira Event Node from the array of clients
        node.removeClient = (_Node) => {
            // Remove the client node from the clients array
            try {
                node.nodeClients = node.nodeClients.filter(x => x.id !== _Node.id)
            } catch (error) { }

            // If there are no more client nodes, unregister the callback functions
            if (node.nodeClients.length === 0 && node.hostavailable) {
                node.unregisterCallbacks();
            }
        }

        // FIXME: not used at the moment - Used to call the status update from the config node.
        node.setNodeStatus = ({ fill, shape, text }) => {
            if (node.server == null) { node.status({ fill: "red", shape: "dot", text: "[NO HOST SELECTED]" }); return; }
            node.status({ fill: fill, shape: shape, text: text });
        }

        // Events
        this.on('close', function (removed, done) {
            if (removed) {
                // This node has been disabled/deleted
                // console.log("Host removed.");
                
            } else {
                // This node is being restarted
                // console.log("Host restarted.");
            }
            node.unregisterCallbacks();
            done();
        });

        // Wait until Token is available, then get the configuration
        var _waituntiltoken = setInterval(function () {
            if (node.checkHostAvailable()) {
                clearInterval(_waituntiltoken);
                node.getUIconfig();
                if (node.nodeClients.length > 0 && !node.callback_registered) {
                    node.registerCallbacks();
                }
            }
        }, 100);

        // Constructor
        // Register Client

        if (node.hosturl) {
            node.registerClient();
        }
        else {
            done("HostUrl is not set.");
        }
    }

    RED.nodes.registerType('gira-host', GiraHost, {
        credentials: {
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });
};
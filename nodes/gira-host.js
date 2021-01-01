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
        node.clientid = 'node-red-contrib-gira-rest.' + node.id;
        node.callbackurl = config.callbackurl;
        node.callbackpath = '/node-red-contrib-gira-rest/' + node.id;

        // node state
        node.token = '';
        node.connected = false;
        node.callback_registered = false;
        node.uiconfig = {};

        // node event clients
        node.nodeClients = [];

        // HTTP endpoint for service callback functions
        RED.httpNode.post(node.callbackpath, function (req, res) {
            // check if token matches the one issued by the API upon registration of the client
            node.trace(req.body);
            if (req.body && req.body.token && req.body.token == node.token) {
                res.sendStatus(200).end();

                // delete security token from response
                delete req.body.token;

                // if uiConfig has changed, update the configuration of the node
                if (req.body.events && req.body.events.length > 0 && req.body.events[0].event == 'uiConfigChanged') {
                    node.getUIconfig();
                }

                if (req.body.events.length > 0) {
                    node.nodeClients.forEach(stack => {
                        if (stack.giranodetype == 'gira-event') {
                            // node.debug(req.body);
                            stack.queueEvent(req.body);
                        }
                    });
                }
                else if (req.body && req.body.token && req.body.token != node.token) {
                    node.setconnectionstate(false);
                    res.sendStatus(401).end();
                }
            }
            // otherwise return 'unauthorized'
            else {
                res.sendStatus(401).end();
            }
        });

        // Functions

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
                // node.debug(data);
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
                // node.debug("unregister callbacks");
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
            node.debug('registerCallbacks: ' + node.callbackpath);
            if (node.callbackpath) {
                const serviceCallback = new URL(node.callbackpath, node.callbackurl).href;
                const valueCallback = new URL(node.callbackpath, node.callbackurl).href;

                node.debug('Registering ' + valueCallback);

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
                    node.debug("Successfully registered callbacks!");
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
                    node.callback_registered = true;
                });
            }
            else {
                node.error('Callback URL not set.');
                node.callback_registered = true;
            }
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
            //if ((node.nodeClients.filter(n => n.giranodetype === 'gira-event').length > 0) && !node.callback_registered && ) {
            //    node.registerCallbacks();
            //}
        }

        // Remove Gira Event Node from the array of clients
        node.removeClient = (_Node) => {
            // Remove the client node from the clients array
            try {
                node.nodeClients = node.nodeClients.filter(x => x.id !== _Node.id)
            } catch (error) { }

            // If there are no more gira-event client nodes, unregister the callback functions
            if ((node.nodeClients.filter(n => n.giranodetype === 'gira-event').length === 0) && node.callback_registered) {
                node.unregisterCallbacks();
            }
        }

        // Register client with Gira API
        node.registerClient = () => {
            node.debug("Register Client.");
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
                    node.setconnectionstate(true);
                }
                else {
                    node.setconnectionstate(false);
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
                node.setconnectionstate(false);
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
            var parameters = { 'token': node.token };
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
                node.debug("unregister client");
                node.setconnectionstate(false);
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

        // Set Connection to disconnected
        node.setconnectionstate = (state) => {
            if (node.connected != state) {
                node.debug("state changed");
                node.connected = state;

                node.nodeClients.forEach(stack => {
                    if (state) {
                        stack.status({ fill: 'green', shape: 'ring', text: 'Connected.' });
                    }
                    else {
                        stack.status({ fill: 'red', shape: 'ring', text: 'Not connected.' });
                    }
                });
            }

            if ( !node.connected ) {
                node.registerApi();
            }

            node.debug('connectionstate = ' + node.connected);
        }

        // keep the node registereds to the API
        node.registerApi = () => {
            if (!node.connected) {
                node.debug("RegisterApi: registerClient()");
                node.registerClient();
            }

            if (node.connected) {
                clearInterval(node.waituntiltoken);
                node.debug('API connected.');
                node.getUIconfig();
                if ((node.nodeClients.filter(n => n.giranodetype == 'gira-event').length > 0)) {
                    node.registerCallbacks();
                }
            }

            if (!node.connected) {
                node.waituntiltoken = setInterval(function () { node.registerApi(); }, 1000);
            }
            else {
                
            }
        }

        // Constructor

        // Wait until token is available, then get the configuration and register callbacks
        node.setconnectionstate(false);

        // Events
        this.on('close', function (removed, done) {
            if (removed) {
                // This node has been disabled/deleted
                // node.debug("Host removed.");

            } else {
                // This node is being restarted
                // node.debug("Host restarted.");
            }
            if (node.callback_registered) {
                node.unregisterCallbacks();
            }
            node.unregisterClient();
            // done();
        });

        // Constructor
        // Register Client

        if (node.hosturl) {
            node.registerClient();
        }
        else {
            node.error("HostUrl is not set.");
        }
    }

    RED.nodes.registerType('gira-host', GiraHost, {
        credentials: {
            username: { type: 'text' },
            password: { type: 'password' }
        }
    });
};
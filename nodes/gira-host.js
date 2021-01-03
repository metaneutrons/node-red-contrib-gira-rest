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
const { debug } = require('request');
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
            const fname = "RED.httpNode.post() ";
            // check if token matches the one issued by the API upon registration of the client
            node.trace(JSON.stringify(req.body));

            if (req.body && req.body.token) {
                if (req.body.token != node.token) {
                    node.setConnectionState(false);
                    res.sendStatus(401).end();
                    res.statusMessage = 'Unauthorized; provided token is wrong.';
                    node.debug(fname + "Token '" + req.body.token + "' wrong; sendStatus=401");
                }
                else if (req.body.token == node.token) {
                    // delete security token from response
                    delete req.body.token;

                    // if uiConfig has changed, update the configuration of the node
                    if (req.body.events && req.body.events.length > 0 && req.body.events[0].event && req.body.events[0].event == 'uiConfigChanged') {
                        node.getUIconfig();
                    }

                    if (req.body.events && req.body.events.length > 0 && req.body.events[0].event && req.body.events[0].event == 'test') {
                        node.debug(fname + "Test request of Gira API received.");
                    }

                    // Not sent by Gira API; just for my mockedup API tests
                    if (req.body.events && req.body.events.length > 0 && req.body.events[0].event && req.body.events[0].event == 'ping') {
                        node.debug(fname + "pong! :)");
                    }

                    if (req.body.events && req.body.events.length > 0) {
                        node.nodeClients.forEach(stack => {
                            if (stack.giranodetype == 'gira-event') {
                                node.debug(fname + 'queue event');
                                stack.queueEvent(req.body);
                            }
                        });
                    }

                    res.sendStatus(200).end();
                    node.debug(fname + "Token correct; sendStatus=200");
                }
            }
            // otherwise return 'server error'
            else {
                node.debug(fname + "Token missing; sendStatus=401");
                res.statusMessage = 'Unauthorized; no token provided.';
                res.sendStatus(401).end();
            }
        });

        // Functions

        // Register Callback functions for event handling
        node.getUIconfig = () => {
            const fname = "getUIconfig() ";
            node.debug(fname);
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
                    message = fname + "Gira API: " + error.body.error.message;
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
            const fname = "unregisterCallbacks() ";
            node.debug(fname);

            if( node.token.length === 0 )
            {
                node.debug(fname + "token not set");
                return;
            }

            var client;
            client = new gira_rest_api.GiraRestApi({ domain: this.hosturl });

            var result;
            node.debug(fname + "token=" + node.token)
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
                node.debug(fname + "successfull");
                node.callback_registered = false;
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = fname + "Gira API: " + error.body.error.message;
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
            const fname = 'registerCallbacks() ';
            node.debug(fname + node.callbackpath);
            if (node.callbackpath) {
                const serviceCallback = new URL(node.callbackpath, node.callbackurl).href;
                const valueCallback = new URL(node.callbackpath, node.callbackurl).href;

                node.debug(fname + 'Registering ' + valueCallback);

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
                    node.debug(fname + "Successfully registered callbacks.");
                    node.callback_registered = true;
                }).catch(function (error) {
                    var message = null;
                    if (error && error.body && error.body.error && error.body.error.message) {
                        message = fname + "Gira API: " + error.body.error.message;
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
            const fname = "registerClient() ";
            node.debug(fname);
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
                    node.debug(fname + "token=" + data.body.token);
                    node.setConnectionState(true);
                }
                else {
                    node.setConnectionState(false);
                    // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                    node.error(fname + "Registration with Gira API failed; no valid 'token' in response.");
                }
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = fname + "Gira API: " + error.body.error.message;
                }
                else if (error && error.body && error.body.message) {
                    message = error.body.message;
                }
                node.setConnectionState(false);
                // FIXME: done() doesn't work here, altough it's the prefered method sice v1.0
                node.error(message);
            });
            return;
        }

        // Unregister client with Gira API
        node.unregisterClient = () => {
            const fname = "unregisterClient() ";
            node.debug(fname);

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
                node.setConnectionState(false);
                node.callback_registered = false;
            }).catch(function (error) {
                var message = null;
                if (error && error.body && error.body.error && error.body.error.message) {
                    message = fname + "Gira API: " + error.body.error.message;
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
        node.setConnectionState = (state) => {
            const fname = "setConnectionState() ";
            if (node.connected != state) {
                node.debug(fname + "state changed");
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

            if (!node.connected) {
                node.waituntiltoken = setTimeout(function () { node.registerApi(); }, 3000);
            }

            if ((!node.callback_registered && node.nodeClients.filter(n => n.giranodetype == 'gira-event').length > 0)) {
                node.registerCallbacks();
            }

            node.debug(fname + "setConnctionState: connectionstate = " + node.connected);
        }

        // keep the node registereds to the API
        node.registerApi = () => {
            const fname = "registerApi() ";
            if (!node.connected) {
                node.debug(fname + "Start registerClient()");
                node.registerClient();
            }
            setTimeout(function () { node.registerApi2(); }, 3000);
        }

        node.registerApi2 = () => {
            const fname = "registerApi() ";
            if (!node.connected) {
                node.debug(fname + "Start registerClient()");
                node.registerClient();
            }

            if (node.connected && node.token) {
                node.debug(fname + "API connected.");
                node.getUIconfig();
                if ((node.nodeClients.filter(n => n.giranodetype == 'gira-event').length > 0)) {
                    node.registerCallbacks();
                }
            }

            if (!node.connected || node.token.length === 0) {
                node.debug(fname + 'API not connected.');
                node.waituntiltoken = setTimeout(function () { node.registerApi(); }, 5000);
            }
        }

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
            done();
        });

        // Constructor

        // Register Client

        if (node.hosturl) {
            node.setConnectionState(false);
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
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
    function GiraSet(config) {
        RED.nodes.createNode(this, config);

        // Retrieve the config node, where the device is configured
        this.host = RED.nodes.getNode(config.host);

        let node = this;

        node.on('input', function (msg, send, done) {
            var errorFlag = false;
            var client;
            if (this.host && this.host.hosturl) {
                client = new gira_rest_api.GiraRestApi({ domain: this.host.hosturl });
            } else {
                errorFlag = true;
                done('HostUrl in configuration node is not specified.', msg);
            }

            if (!node.host.checkHostAvailable()) {
                errorFlag = true;
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });
                done('Gira API Host not available.', msg);
            }
            else {
                node.status({});
            }

            if (!errorFlag && this.host && this.host.credentials) {
                client.setBasicAuth(this.host.credentials.username, this.host.credentials.password);
            }

            var result;
            if (!errorFlag) {
                var parameters = { 'token': this.host.token };
                var payload = msg.payload;

                // values as json, uid set by1 node-dialog is ignored
                if (payload.constructor == ({}).constructor && Object.keys(payload)[0] == "values") {
                    parameters.body = payload;
                    result = client.GiraAPI_SetValues(parameters);
                }
                // value as json or payload, uid set by node-dialog or msg.topic neccessary
                else if ((msg.topic != undefined && msg.topic.length == 4) || config.uid !== undefined) {
                    // set uid by msg.topic
                    if (msg.topic != undefined && msg.topic.length == 4) {
                        parameters.uid = msg.topic;
                    }
                    else
                    // set uid by config.uid
                    {
                        parameters.uid = config.uid;
                    }

                    // value as json
                    if (payload.constructor == ({}).constructor && Object.keys(payload)[0] == "value") {
                        parameters.body = payload;
                    }
                    // error: wrong json
                    else if (payload.constructor == ({}).constructor) {
                        errorFlag = true;
                        done("Payload json has wrong primary key. Should be 'value' or 'values', but is '" + Object.keys(payload)[0] + "'");
                    }
                    // value as other, uid set by node-dialog neccessary
                    else {
                        parameters.body = { 'value': payload };
                    }
                    result = client.GiraAPI_SetValue(parameters);
                }
                else {
                    errorFlag = true;
                    done('Uid not correctly set in configuration dialog or in topic (length must be four chars!).');
                }
            }

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

            if (!errorFlag) {
                node.status({ fill: 'blue', shape: 'dot', text: 'status.requesting' });
                result.then(function (data) {
                    send(setData(msg, data));
                    node.status({});
                }).catch(function (error) {
                    var message = null;
                    if (error && error.body && error.body.error && error.body.error.message) {
                        message = "Gira API: " + error.body.error.message;
                    }
                    else if (error && error.body && error.body.message) {
                        message = error.body.message;
                    }
                    node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });
                    done(message, setData(msg, error));
                    return;
                });
            }
            else {
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });
                return;
            }
        });
    }
    RED.nodes.registerType("gira-set", GiraSet);
};
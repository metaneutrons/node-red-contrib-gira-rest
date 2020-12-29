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
    function GiraGet(config) {
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
                done('HostUrl in configuration node is not specified.', msg);
                errorFlag = true;
            }
            
            if (!this.host.checkHostAvailable()) {
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
                var parameters = { 'token': this.host.token, 'uid': config.uid };

                if (parameters.uid == '' || parameters.uid == undefined) {
                    parameters.uid = msg.payload;
                }

                if (parameters.uid == 'licenses') {
                    result = client.GiraAPI_GetLicenses(parameters);
                }
                else if (parameters.uid == 'uiconfig') {
                    result = client.GiraAPI_GetUIconfig(parameters);
                }
                else if (parameters.uid !== undefined ) {
                    result = client.GiraAPI_GetValue(parameters);
                }
                else
                {
                    errorFlag = true;
                    done( 'Uid not defined by configuration dialog or msg.payload.', msg);
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
                
                // if uiconfig was requested, update host node uiconfig by the way
                if(parameters.uid == 'uiconfig')
                {
                    node.host.uiconfig = data.body;
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
                    if (error && error.body && error.body.error && error.body.error.message )
                    {
                        message = "Gira API: " + error.body.error.message;
                    }
                    else if (error && error.body && error.body.message) {
                        message = error.body.message;
                    }
                    done(message, setData(msg, error));
                    node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });
                    return;
                });
            }
            else
            {
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });
                return;
            }
        });
    }
    RED.nodes.registerType("gira-get", GiraGet);
};

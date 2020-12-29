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

const { send } = require('q');
var gira_rest_api = require('./lib/gira-rest-api.js');

module.exports = function (RED) {
    function GiraEvent(config) {
        RED.nodes.createNode(this, config);

        // Retrieve the config node, where the device is configured
        this.host = RED.nodes.getNode(config.host);
        let node = this;

        node.on('close', function (removed, done) {
            if (removed) {
                // This node has been disabled/deleted
                // console.log("Event removed.");
            } else {
                // This node is being restarted
                //console.log("Event restarted.");
            }
            if (node.host) {
                node.host.removeClient(node);
            }
            done();
        });

        node.queueEvent = body => {
            try {
                delete body.token;
                var message = {'payload': body };
                node.send(message);
                node.status({});
            }
            catch (error) { 
                // console.log(error);
                node.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.error' });
            }
        };

        // On each deploy, unsubscribe+resubscribe
        if (node.host) {
            node.host.removeClient(node);
            node.host.addClient(node);
        }

    }
    RED.nodes.registerType("gira-event", GiraEvent);
};
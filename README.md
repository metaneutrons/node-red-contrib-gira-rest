[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![GPL v3 License][license-image]][license-url]

node-red-contrib-gira-rest
================

[Node-RED](https://nodered.org) node for [Gira X1](https://www.gira.de/produkte/smart-home/gira-x1 "Gira X1 Product Homepage")/[Gira HomeServer](https://www.gira.de/produkte/smart-home/gira-homeserver "Gira HomeServer Product Hompage") REST [API]([gira-api-url] "Gira IoT REST API Documentation" )

## Install

To install the stable version use the `Menu - Manage palette - Install` 
option and search for node-red-contrib-gira-rest, or run the following 
command in your Node-RED user directory, typically `~/.node-red`

    npm install node-red-contrib-gira-rest

## Status of the project

This project is highly beta at the moment. The basic functionality is implemented. No heavy quirks in sight and basic error checking is implemented, too. Help and description in the editor is missing at the moment, but on the list!

## About Gira REST API & unique identifiers (UIDs)

Details about the Gira RESTful API are available [here]([gira-api-url] "Gira IoT REST API Documentation" ). For the interaction with _node-red-contrib-gira-rest_ it's important to know that the Gira API implements the concept of _unique identifiers_ (UIDs). UIDs are four-chars long strings representing one (or a set of) datapoints of the Gira X1/Gira HomeServer.

The API function 'GiraAPI_GetUIconfig' is used to get the whole user interface configuraton from the device. This function is implemented in the _gira-host_ (configuration) node for the use in future versions. At the moment can get the whole UIconfiguration as a JSON-object by using the _gira-get_ node (see below).

As an example for this documentation I use the UID _a00v_. The example UIconfig look like:

```json
{
    "functions": [
        {
            "channelType": "de.gira.schema.channels.KNX.Dimmer",
            "dataPoints": [
                {
                    "canEvent": true,
                    "canRead": true,
                    "canWrite": true,
                    "name": "OnOff",
                    "uid": "a00t"
                },
                {
                    "canEvent": true,
                    "canRead": true,
                    "canWrite": true,
                    "name": "Shift",
                    "uid": "a00u"
                },
                {
                    "canEvent": true,
                    "canRead": true,
                    "canWrite": true,
                    "name": "Brightness",
                    "uid": "a00v"
                }
            ],
            "displayName": "LED Fette",
            "functionType": "de.gira.schema.functions.KNX.Light",
            "parameters": [
                {
                    "key": "ButtonTimeout",
                    "set": "Visu",
                    "value": "0.4"
                },
                {
                    "key": "DefaultShift",
                    "set": "Visu",
                    "value": "10"
                },
                {
                    "key": "OffText",
                    "set": "Visu",
                    "value": "Aus"
                },
                {
                    "key": "OnText",
                    "set": "Visu",
                    "value": "Ein"
                },
                {
                    "key": "ShowOnHomeScreen",
                    "set": "Visu",
                    "value": "False"
                },
                {
                    "key": "ShowStatus",
                    "set": "Visu",
                    "value": "True"
                },
                {
                    "key": "ShowTimer",
                    "set": "Visu",
                    "value": "True"
                }
            ],
            "uid": "a00s"
        }
    ],
    "uid": "a08k"
}
```

## Nodes

### gira-host - Configuration of the API endpoint

All nodes share a common configuration node (_gira-host_) with the following properties:
* **Host URL** - This is the __https-only__ URL of the Gira REST API endpoint. Usualy this points to the __domainname__ or the __IP-address__ of the Gira X1 or Gira HomeServer.
* **Callback URL** - The __https-only__ URL of the Node-Red instance, where the callback service of the node is accessible for the Gira X1 or Gira HomeServer. The callback is used for emitting events from the Gira X1 or Gira HomeServer to the node. This can be the [Node-Red web server itself with an SSL certificate](https://nodered.org/docs/user-guide/runtime/securing-node-red). However, a [reverse proxy server](https://en.wikipedia.org/wiki/Reverse_Proxy) is more preferable ([nginx](https://www.nginx.com), [Træfik](https://traefik.io), et al.). The HTTP callback is using `RED.httpNode`. To avoid conflicts with other nodes, it's using an URL path like `/node-red-contrib-gira-rest/{ ID of the gira-host node }/service'`. For security reasons the callback service expects the token issued by the Gira REST API after first registration of the client in the JSON-object in the body of the request.
* **Username** - The username for accessing the Gira REST API.
* **Password** - The password for accessing the Gira REST API.
* **Name** - The usual Node-Red name property.

### gira-get

With the `gira-get` node it's possible to get a value from the API. There are two ways to tell the node which UIDs to request from the API and to emit as a message:

1. You can set the UID in the configuration dialog.

2. You can set the UID in `msg.payload`, if it's not set in the configuration dialog.

The node may return something like:

```json
{
    "values":
    [
        {"uid":"a00v","value":"0"}
    ]
}
```

If you request UIDs with multiple datapoints (e.g. _a00s_ in the example configuration above), the response would be populated with multiple uids and the corresponding values.

### gira-set

With the `gira-set` node it's possible to set one or multiple values using the API. There are three ways to tell the node which UIDs to set:

1. You can set one or multiples UIDs by sending a JSON-object as `msg.payload` as follows:

```json
{
    "values": 
    [
        {
            "uid": "a00v",
            "value": 0
        }
    ]
}
```

If you emit a JSON-object with the primary key _values_, the UID in the configuration dialog of the node is overruled.

2. You can set the UID as `msg.topic`. If it's set to a four-character long string, the UID in the configuration dialog of the node is overruled.

3. You can set the UID in the configuration dialog. In this case you can set the value in `msg.payload`.

### gira-event

The `gira-event` node is simple to use. It emits all events received by the Gira REST API __service callback & value callback__. A usual `msg.payload` looks like:

```json
{
    "events":
    [
        {
            "uid":"a05d",
            "value":"22"
        }
    ],
    "failures":0
}
```
There are some special events desrcibed in chapter 4.6 of the [Gira REST API]([gira-api-url]) documentation. Most notably is the event `uiConfigChanged`. This event notifies the API client about a change of the internal user interface configuration of the Gira X1/Gira HomeServer. If this event gets fired, the `gira-host` node updates it's internal `uiconfig` object.

## Example
![Example Flow][example-flow-png-url]

## Todos

- [x] ~~Add comprehensive information to the README.md~~
- [x] ~~Add `node.debug` and `node.trace` debugging~~
- [ ] Migrate from `request` to something other...
- [ ] Add helpful information to the configuration of the nodes in the editor
- [ ] Utilize `uiconfig` object for the configuration of the node (TreeView, Dropdowns, et al.)
- [ ] Considerate using information from `uiconfig` for the `gira-event` and `gira-get` output to `msg.payload`

## Licensing

__node-red-contrib-gira-rest__ is licensed under [GNU General Public License v3]([license-url]).

## Donate

I developed this set of nodes for my personal learning experience and use in my smart home. They are probably far from being perfect and probably are not even good examples of how to develop custom nodes for Node-Red. Therefore, I do not ask for money, but I hope that others will contribute and remove my mistakes. But if you absolutely want to send an attention to me, then I do like an invite for a coffee (or mostly tea at the moment)...

[![Donate button](https://www.paypal.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.me/metaneutrons)

[license-image]: https://img.shields.io/badge/License-GPLv3-blue.svg
[license-url]: https://github.com/metaneutrons/node-red-contrib-gira-rest/main/LICENSE
[npm-url]: https://npmjs.org/package/node-red-contrib-gira-rest
[npm-version-image]: https://img.shields.io/npm/v/node-red-contrib-gira-rest.svg
[npm-downloads-month-image]: https://img.shields.io/npm/dm/node-red-contrib-gira-rest.svg
[npm-downloads-total-image]: https://img.shields.io/npm/dt/node-red-contrib-gira-rest.svg
[gira-api-url]: https://download.gira.de/data3/Gira_IoT_REST_API_v2_EN.pdf
[example-flow-png-url]: https://github.com/metaneutrons/node-red-contrib-gira-rest/blob/main/other/gfx/example-node-configuration.png

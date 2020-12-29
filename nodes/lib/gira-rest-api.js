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

/**
 * 
 * @class GiraRestApi
 * @param {(string|object)} [domainOrOptions] - The project domain or options object. If object, see the object's optional properties.
 * @param {string} [domainOrOptions.domain] - The project domain
 * @param {string} [domainOrOptions.username] - The basic auth username
 * @param {string} [domainOrOptions.password] - The basic auth password
 */
var GiraRestApi = (function () {
    'use strict';

    var request = require('request');
    var Q = require('q');
    // var fileType = require('file-type');

    function GiraRestApi(options) {
        var domain = (typeof options === 'object') ? options.domain : options;
        var username = (typeof options === 'object') ? options.username : options;
        var password = (typeof options === 'object') ? options.password : options;

        this.domain = domain ? domain : '';
        if (this.domain.length === 0) {
            throw new Error('Domain parameter must be specified as a string.');
        }

        this.domain = this.domain + "/api/v2";
        this.basic = (typeof options === 'object') ? (options.basic ? options.basic : {}) : {};

        if (username && password) {
            // this.setBasicAuth(username, password);
            this.basic.username = username;
            this.basic.password = password;
        }
    }

    function mergeQueryParams(parameters, queryParameters) {
        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters)
                .forEach(function (parameterName) {
                    var parameter = parameters.$queryParameters[parameterName];
                    queryParameters[parameterName] = parameter;
                });
        }
        return queryParameters;
    }

    /**
     * HTTP Request
     * @method
     * @name GiraRestApi#request
     * @param {string} method - http method
     * @param {string} url - url to do request
     * @param {object} parameters
     * @param {object} body - body parameters / object
     * @param {object} headers - header parameters
     * @param {object} queryParameters - querystring parameters
     * @param {object} form - form data object
     * @param {object} deferred - promise object
     */
    GiraRestApi.prototype.request = function (method, url, parameters, body, headers, queryParameters, form, deferred) {
        var req = {
            method: method,
            uri: url,
            qs: queryParameters,
            rejectUnauthorized: false,
            headers: headers,
            body: body
        };
        /*        if(Object.keys(form).length > 0) {
                    if (req.headers['Content-Type'] && req.headers['Content-Type'][0] === 'multipart/form-data') {
                        delete req.body;
                        var keyName = Object.keys(form)[0]
                        req.formData = {
                            [keyName]: {
                                value: form[keyName],
                                options: {
                                    filename: (fileType(form[keyName]) != null ? `file.${ fileType(form[keyName]).ext }` : `file` )
                                }
                            }
                        };
                    } else {
                        req.form = form;
                    }
                }
        */
        if (typeof (body) === 'object' && !(body instanceof Buffer)) {
            req.json = true;
        }
        request(req, function (error, response, body) {
            if (error) {
                deferred.reject(error);
            } else {
                if (/^application\/(.*\\+)?json/.test(response.headers['content-type'])) {
                    try {
                        body = JSON.parse(body);
                    } catch (e) { }
                }
                if (response.statusCode === 204) {
                    deferred.resolve({ response: response });
                } else if (response.statusCode >= 200 && response.statusCode <= 299) {
                    deferred.resolve({ response: response, body: body });
                } else {
                    deferred.reject({ response: response, body: body });
                }
            }
        });
    };

    /**
    * Set Basic Auth
    * @method
    * @name GiraRestApi#setBasicAuth
    * @param {string} username
    * @param {string} password
    */
    GiraRestApi.prototype.setBasicAuth = function (username, password) {
        this.basic.username = username;
        this.basic.password = password;
    };
    /**
    * Set Auth headers
    * @method
    * @name GiraRestApi#setAuthHeaders
    * @param {object} headerParams - headers object
    */
    GiraRestApi.prototype.setAuthHeaders = function (headerParams) {
        var headers = headerParams ? headerParams : {};
        if (this.basic.username && this.basic.password) {
            headers['Authorization'] = 'Basic ' + new Buffer.from(this.basic.username + ':' + this.basic.password).toString("base64");
        }
        return headers;
    };

    /**
     * Checks availability of GIRA RESTful API and returns deviceName, deviceType, deviceVersion, info and API version.
     * @method
     * @name GiraRestApi#GiraAPI_IsAvailable
     * @param {object} parameters - method options and parameters
     * @returns {object} - {"deviceName":"<devicename>","deviceType":"<devicetype>","deviceVersion":"<devver>","info":"GDS-REST-API","version":"2"} }
     */
    GiraRestApi.prototype.GiraAPI_IsAvailable = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('GET', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Registers client with identifier with basic authentication (username and password) and returns token.
     * @method
     * @name GiraRestApi#GiraAPI_RegisterClient
     * @param {object} parameters - method options and parameters
         * @param {} parameters.body - { 'client': '<clientid>'}
     * @returns {object} - { "token": "<client access token>" }
     */
    GiraRestApi.prototype.GiraAPI_RegisterClient = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/clients';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        headers = this.setAuthHeaders(headers);
        headers['Content-Type'] = ['application/json'];
        if (parameters['body'] !== undefined) {
            body = parameters['body'];
        }
        if (parameters['body'] === undefined) {
            deferred.reject(new Error('Missing required parameter: body'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('POST', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Unregisters client by token.
     * @method
     * @name GiraRestApi#GiraAPI_UnregisterClient
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient
     */
    GiraRestApi.prototype.GiraAPI_UnregisterClient = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/clients/{token}';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        path = path.replace('{token}', parameters['token']);

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required  parameter: token'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('DELETE', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Registers callbacks for (optional) serviceCallback, (optional) valueCallback and (optionally) test the service before registering when testCallbacks is true.
     * @method
     * @name GiraRestApi#GiraAPI_RegisterCallbacks
     * @param {object} parameters - method options and parameters
         * @param {object} parameters.body - URLs for callback services
         * {"serviceCallback":"<url>","valueCallback":"<url>","testCallbacks": <boolean> }
         * @param {string} parameters.token - token from RegisterClient
     */
    GiraRestApi.prototype.GiraAPI_RegisterCallbacks = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/clients/{token}/callbacks';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        headers['Content-Type'] = ['application/json'];

        if (parameters['body'] !== undefined) {
            body = parameters['body'];
        }

        path = path.replace('{token}', parameters['token']);

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('POST', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Unregisters alls Callbacks by token
     * @method
     * @name GiraRestApi#GiraAPI_UnregisterCallbacks
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient
     */
    GiraRestApi.prototype.GiraAPI_UnregisterCallbacks = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/clients/{token}/callbacks';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        path = path.replace('{token}', parameters['token']);

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('DELETE', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Get UI configuration ID of Gira X1/Gira HomeServer
     * @method
     * @name GiraRestApi#GiraAPI_GetUIconfigID
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient
     * @returns {object} - uid
     */
    GiraRestApi.prototype.GiraAPI_GetUIconfigID = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/uiconfig/uid';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        headers['Content-Type'] = ['application/json'];

        if (parameters['token'] !== undefined) {
            queryParameters['token'] = parameters['token'];
        }

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('GET', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Get all UIDs as an json-array.
     * @method
     * @name GiraRestApi#GiraAPI_GetUIconfig
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient
         * @param {string} parameters.expand - expands json-array to dataPointFlags,parameters,locations,trades (comma-separeted)
     * @returns {object} - UIconfig
     */
    GiraRestApi.prototype.GiraAPI_GetUIconfig = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/uiconfig';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        headers['Content-Type'] = ['application/json'];

        if (parameters['token'] !== undefined) {
            queryParameters['token'] = parameters['token'];
        }

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        if (parameters['expand'] !== undefined) {
            queryParameters['expand'] = parameters['expand'];
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('GET', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Gets value of UID.
     * @method
     * @name GiraRestApi#GiraAPI_GetValue
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient 
         * @param {string} parameters.uid - UIUD of requested value
     * @returns {object} - array of values {"values":[{"uid":"a04l","value":"1"}]}
     */
    GiraRestApi.prototype.GiraAPI_GetValue = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/values/{uid}';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        if (parameters['token'] !== undefined) {
            queryParameters['token'] = parameters['token'];
        }

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        path = path.replace('{uid}', parameters['uid']);

        if (parameters['uid'] === undefined) {
            deferred.reject(new Error('Missing required parameter: uid'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('GET', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };

    /**
     * Sets UID to value.
     * @method
     * @name GiraRestApi#GiraAPI_SetValue
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient 
         * @param {} parameters.body - value or json { 'value': <value> }
         * @param {string} parameters.uid - UID of value to set
     */
    GiraRestApi.prototype.GiraAPI_SetValue = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/values/{uid}';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        headers['Content-Type'] = ['application/json'];

        if (parameters['token'] !== undefined) {
            queryParameters['token'] = parameters['token'];
        }

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        if (parameters['body'] !== undefined) {
            body = parameters['body'];
        }

        if (parameters['body'] === undefined) {
            deferred.reject(new Error('Missing required parameter: body'));
            return deferred.promise;
        }

        if (parameters['uid'] === undefined) {
            deferred.reject(new Error('Missing required parameter: uid'));
            return deferred.promise;
        }

        path = path.replace('{uid}', parameters['uid']);

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('PUT', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Sets multiple UIDs to different values.
     * @method
     * @name GiraRestApi#GiraAPI_SetValues
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient
         * @param {} parameters.body - { 'values': [ { 'uid': '<uid>', 'value': '<value>' }, ... ] }
     */
    GiraRestApi.prototype.GiraAPI_SetValues = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/values';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        headers['Content-Type'] = ['application/json'];

        if (parameters['token'] !== undefined) {
            queryParameters['token'] = parameters['token'];
        }

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        if (parameters['body'] !== undefined) {
            body = parameters['body'];
        }

        if (parameters['body'] === undefined) {
            deferred.reject(new Error('Missing required parameter: body'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('PUT', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };
    /**
     * Gets als licenses installed on Gira X1/HomeServer as json-array.
     * @method
     * @name GiraRestApi#GiraAPI_GetLicenses
     * @param {object} parameters - method options and parameters
         * @param {string} parameters.token - token from RegisterClient 
     * @returns {object} - license information
     */
    GiraRestApi.prototype.GiraAPI_GetLicenses = function (parameters) {
        if (parameters === undefined) {
            parameters = {};
        }
        var deferred = Q.defer();
        var domain = this.domain, path = '/licenses';
        var body = {}, queryParameters = {}, headers = {}, form = {};

        if (parameters['token'] !== undefined) {
            queryParameters['token'] = parameters['token'];
        }

        if (parameters['token'] === undefined) {
            deferred.reject(new Error('Missing required parameter: token'));
            return deferred.promise;
        }

        queryParameters = mergeQueryParams(parameters, queryParameters);

        this.request('GET', domain + path, parameters, body, headers, queryParameters, form, deferred);

        return deferred.promise;
    };

    return GiraRestApi;
})();

exports.GiraRestApi = GiraRestApi;
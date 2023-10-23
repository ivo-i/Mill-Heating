'use strict';

const axios = require('axios');
const Room = require('./models');

class MillAPI {
    constructor(app) {
        this.app = app;
    }

    async login(username, password) {
        throw new Error('Not implemented');
    }

    async request(command, body = null, requestMethod = 'get') {
        throw new Error('Not implemented');
    }
}

module.exports = MillAPI;
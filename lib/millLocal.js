'use strict';

const axios = require('axios');
const millAPI = require('./millAPI');

class MillLocal extends millAPI {
    constructor(ipAddress) {
        super(null);

        if (typeof ipAddress !== 'string') {
            throw new Error('Constructor parameter ipAddress must be a string. Got ' + typeof ipAddress + ' instead.');
        }

        if (!ipAddress) {
            throw new Error("Ingen lokal Mill-ovn til stede. Avslutter MillLocal.");
        }

        this.ipAddress = ipAddress;
        this.baseUrl = `http://${this.ipAddress}`;
        this.authEndpoint = 'https://api.millnorwaycloud.com';

        this.initLocalApi();
    }

    async initLocalApi() {
        if (!this.ipAddress) {
            return;
        } else {
            return setInterval(async () => {
                await this.checkOperationMode();
            }, 1000);
        }
    }

    async checkOperationMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/control-status`);
            const mode = response.data.operation_mode;

            if (mode.toLowerCase() === 'off') {
                return;
            }

            if (this.prevMode !== mode) {
                this.emit('operationMode', mode);
                this.prevMode = mode;
            }

            return mode === 'Control individually';
        } catch (error) {
            console.log('Error:', error);
            return error.response;
        }
    }

    async login(username, password) {
        const body = {
            'login': username,
            'password': password,
        };

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const endpoint = `${this.authEndpoint}/customer/auth/sign-in`;
        try {
            const response = await axios.post(endpoint, body, { headers });
            const data = response.data;
            this.auth = {
                token: data.idToken,
                refreshToken: data.refreshToken,
            };

            this.user = {
                ...data,
                login: username,
                password: password,
            };

            this.app.dDebug(`Successfully logged in as ${this.user.login}`);

            return response;
        } catch (error) {
            if (error.response) {
                this.app.dError(error.response.data);
                this.app.dError(error.response.status);
                this.app.dError(error.response.headers);
            } else if (error.request) {
                this.app.dError(error.request);
            } else {
                this.app.dError('Error', error);
            }
            if (error.response && error.response.data.error.type === 'LogInError') {
                this.app.dError(error.response.data.error.message);
            }
            return error.response;
        }
    }

    async ping() {
        try {
            const response = await axios.get(`${this.baseUrl}/status`);
            if (response.status === 200 && response.data.status === 'ok') {
                return true;
            }
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getStatus() {
        try {
            const response = await axios.get(`${this.baseUrl}/status`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async reboot() {
        try {
            const response = await axios.post(`${this.baseUrl}/reboot`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getControlStatus() {
        try {
            const response = await axios.get(`${this.baseUrl}/control-status`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getOperationMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/operation-mode`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async setOperationMode(mode) {
        try {
            const response = await axios.post(`${this.baseUrl}/operation-mode`, {
                mode: mode
            });
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getWeeklyProgram() {
        try {
            const response = await axios.get(`${this.baseUrl}/weekly-program`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getDisplayUnit() {
        try {
            const response = await axios.get(`${this.baseUrl}/display-unit`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getSetTemperature() {
        try {
            const response = await axios.get(`${this.baseUrl}/set-temperature`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async setTemperature(value) {
        try {
            const response = await axios.post(`${this.baseUrl}/set-temperature`, {
                type: 'Normal',
                value: value
            });
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async overwriteWeeklyProgram(duration, type) {
        try {
            const response = await axios.post(`${this.baseUrl}/overwrite-weekly-program`, {
                duration: duration,
                type: type
            });
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getVacationMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/vacation-mode`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async setVacationMode(start_timestamp, end_timestamp) {
        try {
            const response = await axios.post(`${this.baseUrl}/vacation-mode`, {
                start_timestamp: start_timestamp,
                end_timestamp: end_timestamp
            });
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getTimezoneOffset() {
        try {
            const response = await axios.get(`${this.baseUrl}/timezone-offset`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getAdditionalSocketMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/additional-socket-mode`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async getCloudCommunication() {
        try {
            const response = await axios.get(`${this.baseUrl}/cloud-communication`);
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async setCloudCommunication(value) {
        try {
            const response = await axios.post(`${this.baseUrl}/cloud-communication`, {
                value: value
            });
            return response.data;
        } catch (error) {
            this.app.dError(error.message);
        }
    }

    async pingLocalDevice(ip) {
        try {
            const json = await axios.get(`http://${ip}/status`);

            if (json.status === 200 && json.data.status === 'ok') {
                return { success: true, data: json.data }
            }
        } catch (error) {
            this.app.dError(error.message);
        }
    }
}

module.exports = MillLocal;
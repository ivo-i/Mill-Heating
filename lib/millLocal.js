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
        this.connected = false;
        this.hasEmittedConnectionEstablished = false;
        this.hasEmittedConnectionLost = false;

        this.initLocalApi();
    }

    async initLocalApi() {
        if (!this.ipAddress) {
            return;
        } else {
            return this.operationModeInterval = setInterval(async () => {
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
            if (this.connected && !this.hasEmittedConnectionEstablished) {
                this.emit('connectionEstablished');
                this.hasEmittedConnectionEstablished = true;
            }

            this.connected = true;
            this.hasEmittedConnectionLost = false;

            return mode === 'Control individually';
        } catch (error) {
            this.connected = false;
            this.hasEmittedConnectionEstablished = false;

            if (!this.connected && !this.hasEmittedConnectionLost) {
                this.emit('connectionLost', `Error caught while checking operation mode ${error.message}`);
                this.hasEmittedConnectionLost = true;
                return error.message;
            }
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

            //this.app.dDebug(`Successfully logged in as ${this.user.login}`);

            return response;
        } catch (error) {
            if (error.response) {
                return error.response;
            } else if (error.request) {
                return error.request;
            }
            if (error.response && error.response.data.error.type === 'LogInError') {
                return error.response.data.error.message;
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
            return error.message;
        }
    }

    async getStatus() {
        try {
            const response = await axios.get(`${this.baseUrl}/status`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async reboot() {
        try {
            const response = await axios.post(`${this.baseUrl}/reboot`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getControlStatus() {
        try {
            const response = await axios.get(`${this.baseUrl}/control-status`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getOperationMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/operation-mode`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async setOperationMode(mode) {
        try {
            const response = await axios.post(`${this.baseUrl}/operation-mode`, {
                mode: mode
            });
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getWeeklyProgram() {
        try {
            const response = await axios.get(`${this.baseUrl}/weekly-program`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getDisplayUnit() {
        try {
            const response = await axios.get(`${this.baseUrl}/display-unit`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getSetTemperature() {
        try {
            const response = await axios.get(`${this.baseUrl}/set-temperature`);
            return response.data;
        } catch (error) {
            return error.message;
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
            return error.message;
        }
    }

    async setOilHeaterPowerMode(value) {
        try {
            const response = await axios.post(`${this.baseUrl}/oil-heater-power`, {
                heating_level_percentage: Number(value)
            });
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getOilHeaterPowerMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/oil-heater-power`);
            return response.data;
        } catch (error) {
            return error.message;
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
            return error.message;
        }
    }

    async getVacationMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/vacation-mode`);
            return response.data;
        } catch (error) {
            return error.message;
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
            return error.message;
        }
    }

    async getTimezoneOffset() {
        try {
            const response = await axios.get(`${this.baseUrl}/timezone-offset`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getAdditionalSocketMode() {
        try {
            const response = await axios.get(`${this.baseUrl}/additional-socket-mode`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async getCloudCommunication() {
        try {
            const response = await axios.get(`${this.baseUrl}/cloud-communication`);
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async setCloudCommunication(value) {
        try {
            const response = await axios.post(`${this.baseUrl}/cloud-communication`, {
                value: value
            });
            return response.data;
        } catch (error) {
            return error.message;
        }
    }

    async pingLocalDevice(ip) {
        try {
            const json = await axios.get(`http://${ip}/status`);

            if (json.status === 200 && json.data.status === 'ok') {
                return { success: true, data: json.data }
            }
        } catch (error) {
            return error.message;
        }
    }

    async autoScan(ip, callback) {
        //console.log('Scanning local network for Mill devices...');
        const ipParts = ip.split('.');
        if (ipParts.length !== 4) {
            callback({ error: 'Invalid IP-address', ip: null, status: 'error' });
            return 'Invalid IP-address';
        }
        for (let i = 0; i < 3; i++) {
            if (ipParts[i] < 0 || ipParts[i] > 255) {
                callback({ error: 'Invalid IP-address', ip: null, status: 'error' });
                return 'Invalid IP-address';
            }
        }

        const ipBase = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;

        const ipList = [];
        for (let i = 2; i < 255; i++) {
            ipList.push(`${ipBase}.${i}`);
        }

        const responseList = [];
        for (const ip of ipList) {
            try {
                //console.log(`Checking IP-address ${ip}`);
                callback({ error: null, ip: ip, status: 'checking', message: `Checking IP-address ${ip}` });
                const response = await axios.get(`http://${ip}/status`, { timeout: 500 });
                if (response.data && response.data.status === 'ok') {
                    //console.log(`Found Mill device at IP-address ${ip}`);
                    response.data.ip_address = ip;
                    callback({ error: null, ip: ip, status: 'found', message: `Found Mill device at IP-address ${ip}`, data: response.data });
                    responseList.push(response.data);
                }
            } catch (error) {
                let message = 'No response';
                if (error.response && error.response.status === 404) {
                    message = `Found device at IP-address ${ip} but it doesn't seem to be a Mill device`;
                }
                callback({ error: null, ip: ip, status: 'not found', message: message });
            }
        }

        if (responseList.length === 0) {
            //console.log('No Mill devices found');
            callback({ error: 'No Mill devices found', ip: null, status: 'error' });
            return { success: false, error: 'No Mill devices found' };
        }

        //console.log('Found Mill devices:', responseList);
        callback({ error: null, ip: null, status: 'done', message: 'Found Mill devices: ' + responseList.map(device => `${device.name} (${device.ip_address})`).join(', ') });
        return { success: true, data: responseList };
    }
}

module.exports = MillLocal;
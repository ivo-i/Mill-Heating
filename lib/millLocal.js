'use strict';

const Room = require('./models');
const axios = require('axios');
const millAPI = require('./millAPI');

class MillLocal extends millAPI {
	constructor(ipAddress) {
		super(null);
		this.ipAddress = ipAddress;
		this.baseUrl = `http://${this.ipAddress}`;
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
		const response = await axios.get(`${this.baseUrl}/status`);
		if (response.status === 200 && response.data.status === 'ok') {
			return true;
		} else {
			return false;
		}
	}

	async getStatus() {
		const response = await axios.get(`${this.baseUrl}/status`);
		return response.data;
	}

	async reboot() {
		const response = await axios.post(`${this.baseUrl}/reboot`);
		return response.data;
	}

	async getControlStatus() {
		const response = await axios.get(`${this.baseUrl}/control-status`);
		return response.data;
	}

	async getOperationMode() {
		const response = await axios.get(`${this.baseUrl}/operation-mode`);
		return response.data;
	}

	async setOperationMode(mode) {
		const response = await axios.post(`${this.baseUrl}/operation-mode`, {
			mode: mode
		});
		return response.data;
	}

	async getWeeklyProgram() {
		const response = await axios.get(`${this.baseUrl}/weekly-program`);
		return response.data;
	}

	async getDisplayUnit() {
		const response = await axios.get(`${this.baseUrl}/display-unit`);
		return response.data;
	}

	async getSetTemperature() {
		const response = await axios.get(`${this.baseUrl}/set-temperature`);
		return response.data;
	}

	async setTemperature(type, value) {
		const response = await axios.post(`${this.baseUrl}/set-temperature`, {
			type: type,
			value: value
		});
		return response.data;
	}

	async overwriteWeeklyProgram(duration, type) {
		const response = await axios.post(`${this.baseUrl}/overwrite-weekly-program`, {
			duration: duration,
			type: type
		});
		return response.data;
	}

	async getVacationMode() {
		const response = await axios.get(`${this.baseUrl}/vacation-mode`);
		return response.data;
	}

	async setVacationMode(start_timestamp, end_timestamp) {
		const response = await axios.post(`${this.baseUrl}/vacation-mode`, {
			start_timestamp: start_timestamp,
			end_timestamp: end_timestamp
		});
		return response.data;
	}

	async getTimezoneOffset() {
		const response = await axios.get(`${this.baseUrl}/timezone-offset`);
		return response.data;
	}

	async getAdditionalSocketMode() {
		const response = await axios.get(`${this.baseUrl}/additional-socket-mode`);
		return response.data;
	}

	async getCloudCommunication() {
		const response = await axios.get(`${this.baseUrl}/cloud-communication`);
		return response.data;
	}

	async setCloudCommunication(value) {
		const response = await axios.post(`${this.baseUrl}/cloud-communication`, {
			value: value
		});
		return response.data;
	}

	async pingLocalDevice(ip) {
		const json = await axios.get(`http://${ip}/status`);

		if (json.status === 200 && json.data.status === 'ok') {
			return { success: true, data: json.data }
		} else {
			false;
		}
	}
}

module.exports = MillLocal;
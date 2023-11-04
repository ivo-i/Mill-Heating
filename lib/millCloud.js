'use strict';

const Room = require('./models');
const axios = require('axios');
const millAPI = require('./millAPI');
const homey = require('homey');

class MillCloud extends millAPI {
	constructor(app) {
		super(app);

		if (typeof app !== 'object') {
			throw new Error('Constructor parameter app must be an object. Got ' + typeof app + ' instead.');
		}

		if (MillCloud.instance) {
			return MillCloud.instance;
		}

		MillCloud.instance = this;

		this.authEndpoint = 'https://api.millnorwaycloud.com';
		this.endpoint = 'https://api.millnorwaycloud.com';
		this.user = null;
		this.auth = {};
		this.nonce = 'AQcDfGrE34DfGdsV';
		this.timeZoneNum = '+02:00';
		this.isRefreshing = false;
		this.pendingRequests = [];
		this.operationMode = null;

		this.app = app;
	}

	async checkOperationMode(mode) {
		try {
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

	async ping() {
		return this.app.isConnected();
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

	async processQueue(error, token = null) {
		this.pendingRequests.forEach((prom) => {
			if (error) {
				prom.reject(error);
			} else {
				prom.resolve(token);
			}
		});

		this.pendingRequests = [];
	}

	async updateAccessToken() {
		// Ensure that any pending request finishes before proceeding.
		if (this.isRefreshing) {
			return new Promise((resolve, reject) => {
				this.pendingRequests.push({ resolve, reject });
			});
		}

		this.isRefreshing = true;
		this.app.dDebug('Refreshing access token');

		try {
			const headers = {
				'Accept': 'application/json',
				'Authorization': 'Bearer ' + this.auth.refreshToken,
			};

			const endpoint = `${this.authEndpoint}/customer/auth/refresh`;
			const response = await axios.post(endpoint, {}, { headers });
			const { idToken, refreshToken } = response.data;

			this.auth = {
				token: idToken,
				refreshToken,
			};

			this.isRefreshing = false;
			this.processQueue(null, idToken);
			this.app.dDebug('Access token refreshed');
		} catch (error) {
			if (error.response && error.response.status === 401) {
				this.app.dError('Refresh token expired. Reconnecting to Mill.');
				return await this.app.connectToMill()
					.then(() => {
						this.app.dDebug('Successfully reconnected to Mill');
					})
					.catch((error) => {
						this.app.dError('Failed to reconnect to Mill', error);
						throw new Error('Failed to reconnect to Mill', error);
					});
			}
			this.isRefreshing = false;
			this.processQueue(error);
			this.app.dError('Failed to refresh access token', error);
			throw error;
		}
	}

	async request(command, body = null, requestMethod = 'get') {
		// Ensure that any pending request finishes before proceeding.
		if (this.isRefreshing) {
			await new Promise((resolve) => {
				this.pendingRequests.push({ resolve });
			});
		}

		const headers = {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'Authorization': 'Bearer ' + this.auth.token,
		};

		try {
			const endpoint = `${this.endpoint}/${command}`;
			let response;
			switch (requestMethod.toLowerCase()) {
				case 'delete':
					response = await axios.delete(endpoint, { headers });
					break;
				case 'patch':
					response = await axios.patch(endpoint, body, { headers });
					break;
				case 'post':
					response = await axios.post(endpoint, body, { headers });
					break;
				case 'get':
				default:
					response = await axios.get(endpoint, { headers });
					break;
			}

			await this.updateControlSources(response);

			if (response.data?.deviceSettings?.reported?.operation_mode && response.data.deviceSettings.reported.operation_mode !== 'control_individually') {
				const operationMode = response.data.deviceSettings.reported.operation_mode;
				await this.checkOperationMode(operationMode);
			}

			return response.data;
		} catch (error) {
			if (error.response && error.response.status === 401) {
				// Token expired, refresh and retry request
				await this.updateAccessToken();
				return this.request(command, body, requestMethod);
			} else {
				throw error;
			}
		}
	}

	async getCustomer() {
		const headers = {
			'Content-Type': 'application/json',
			'Accept': 'application/json',
			'Authorization': 'Bearer ' + this.auth.token,
		};

		const result = await axios.get(`${this.endpoint}/customer/details`, { headers });
		if (result.status === 200) {
			return true;
		} else {
			return false;
		}
	}

	async updateControlSource(deviceId, controlSource = 'open_api') {
		const body = {
			deviceIds: [deviceId],
			controlSource: controlSource,
		};

		return this.request(`devices/control`, body, 'patch');
	}

	async updateRoomControlSource(roomId, controlSource = 'open_api') {
		const body = {
			controlSource: controlSource,
		};

		return this.request(`rooms/${roomId}/external-control`, body, 'patch');
	}

	async updateControlSources(response) {
		// Sjekk om 'controlSource' eksisterer i responsen og om den ikke er 'open_api'
		if (response.data?.controlSource && response.data.controlSource !== 'open_api') {
			try {
				this.app.dDebug(`[${this.app.homey.manifest.name.en}] Control source is mobile_api, updating to open_api`);
				// Anta at 'deviceId' er tilgjengelig i responsen, ellers må du erstatte 'response.data.deviceId' med riktig felt
				await this.updateControlSource(response.data.deviceId, 'open_api');
				this.app.dDebug(`[${this.app.homey.manifest.name.en}] Control source set to open_api`);
			} catch (err) {
				this.app.dError(`[${this.app.homey.manifest.name.en}] Error setting control source to open_api... Please report this to the developer!`, err.message);
			}
		}
	}

	// returns a list of homes
	async listHomes() {
		return this.request(`houses`);
	}

	// returns a list of rooms in a house
	async listRooms(homeId) {
		return this.request(`houses/${homeId}/rooms`);
	}

	async listDevices(homeId) {
		return this.request(`houses/${homeId}/devices`);
	}

	// returns a list of devices in a room
	async listRoomDevices(roomId) {
		const room = await this.request(`rooms/${roomId}/devices`);
		if (!Room.validateRoom(room)) {
			throw new Error(`Invalid response from Mill API: ${JSON.stringify(room)}`);
		}

		return new Room(room);
	}

	async listIndependentDevices(homeId, filter = 'sensorsAndPurifiers') {
		return this.request(`houses/${homeId}/devices/independent?filterDevices=${filter}`);
	}

	async getDevice(deviceId) {
		return this.request(`devices/${deviceId}/data`);
	}

	async getControlStatus(deviceId) {
		let response = await this.request(`devices/${deviceId}/data`);
		response = {
			ambient_temperature: response.lastMetrics.temperatureAmbient,
			humidity: response.lastMetrics.humidity,
			current_power: response.lastMetrics.currentPower,
			raw_ambient_temperature: response.lastMetrics.temperature,
			set_temperature: response.deviceSettings.reported.temperature_last_set,
			switched_on: response.lastMetrics.powerStatus === 1 ? true : false,
			connected_to_cloud: true,
			control_signal: response.lastMetrics.controlSignal,
			operation_mode: response.deviceSettings.reported.operation_mode,
			control_source: response.controlSource,
		}
		return response;
	}

	async setTemperature(temperature, deviceId, deviceType = "Heaters") {
		const body = {
			"deviceType": deviceType,
			"enabled": true,
			"settings": {
				"temperature_normal": temperature
			}
		};
		return this.request(`devices/${deviceId}/settings`, body, 'patch');
	}

	async changeRoomTemperature(roomId, tempSettings) {
		const body = {
			roomComfortTemperature: tempSettings.roomComfortTemperature,
			roomSleepTemperature: tempSettings.roomSleepTemperature,
			roomAwayTemperature: tempSettings.roomAwayTemperature
		};
		return this.request(`rooms/${roomId}/temperature`, body, 'post');
	}

	async getOperationMode(deviceId) {
		const response = await this.request(`devices/${deviceId}/data`);
		return { mode: response.deviceSettings.reported.operation_mode };
	}

	async setOperationMode(mode, deviceId, deviceType = "Heaters") {
		switch (mode) {
			case 'Control individually':
				mode = 'control_individually';
				break;
			case 'Off':
				mode = 'off';
				break;
			default:
				mode = 'control_individually';
				break;
		}
		const body = {
			"deviceType": deviceType,
			"enabled": mode !== "off" ? true : false,
			"settings": {
				"operation_mode": mode
			}
		};
		return this.request(`devices/${deviceId}/settings`, body, 'patch');
	}

	async changeRoomMode(roomId, mode) {
		if (mode === 'weekly_program') {
			const body = {
				disableOverride: true,
			};
			return this.request(`rooms/${roomId}/mode/override`, body, 'delete');
		}

		const now = new Date();
		now.setHours(now.getHours() + 3);
		const epochPlusOneHour = now.getTime();

		const body = {
			overrideModeType: 'continuous',
			overrideEndDate: 9999999999,
			mode: mode
		};
		return this.request(`rooms/${roomId}/mode/override`, body, 'post');
	}

	async changeFanMode(deviceId, mode) {
		const state = mode !== "SOFT_OFF" && mode !== "HARD_OFF";
		const body = {
			deviceType: 'Air Purifiers',
			enabled: state,
			settings: {
				fan_speed_mode: mode
			}
		};
		this.app.dDebug(`changeFanMode body ${body}`);
		return this.request(`devices/${deviceId}/settings`, body, 'patch');
	}

	async checkMigrationStatus(email) {
		const headers = {
			'Accept': 'application/json',
		};

		if (email.includes('@')) {
			var loginType = 'email';
		} else {
			var loginType = 'phoneNumber';
		}

		const endpoint = `${this.endpoint}/cloud-migration/migration-status?loginType=${loginType}&login=${email}`;
		const json = await axios.get(endpoint, { headers });

		if (json.error) {
			throw new Error(json.data);
		} else {
			this.app.dError(json.data);
			this.app.dError(endpoint);
			if (json.data.needSynchronize === true) {
				return false;
			} else {
				return true;
			}
		}
	}

	async migrateCustomer(username, password) {
		const headers = {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		};

		if (username.includes('@')) {
			var loginType = 'email';
		} else {
			var loginType = 'phoneNumber';
		}

		const body = {
			"login": {
				"type": loginType,
				"value": username
			},
			"password": password,
		};

		const endpoint = `${this.endpoint}/cloud-migration/migrate-customer`;
		const json = await axios.post(endpoint, body, { headers });

		if (json.error) {
			throw new Error(json.data);
		} else {
			if (json.data.status === 'ok') {
				true;
			} else {
				false;
			}
		}
	}
}

module.exports = MillCloud;
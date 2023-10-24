'use strict';

const { Device } = require('homey');
const Room = require('../../lib/models');
const millLocal = require('../../lib/millLocal');
const millCloud = require('../../lib/millCloud');

class MillDeviceV2 extends Device {
	async onInit() {
		this.deviceId = this.getData().id;
		this.homey.app.dDebug(`[${this.getName()}] (${this.deviceId}) initialized`);

		this.apiVersion = this.getData().apiVersion;
		this.ipAddress = this.getData().ipAddress;
		this.deviceType = this.getData().deviceType;
		this.deviceInstance = null;
		this.deviceSettings = this.getSettings();
		this.deviceData = {};
		this.loginData = {
			username: await this.homey.settings.get('username') || null,
			password: await this.homey.settings.get('password') || null,
		};
		this.lastLoggedTime = null;

		if (this.getData().apiVersion === 'local') {
			this.millApi = new millLocal(this.ipAddress);
			this.deviceInstance = this.ipAddress;
		} else {
			this.millApi = new millCloud(this.homey.app);
			this.deviceInstance = this.deviceId;
		}

		const operationMode = await this.millApi.getOperationMode(this.deviceInstance);
		if (operationMode.mode !== 'Control individually' && operationMode.mode !== 'control_individually') {
			this.log(`[${this.getName()}] Mill ${this.getName()} is not in Control individually mode. Changing now...`);

			await this.millApi.setOperationMode('Control individually', this.deviceInstance, this.deviceType).then((result) => {
				this.log(`[${this.getName()}] Mill ${this.getName()} is now in Control individually mode`, {
					response: result,
				});
			}).catch((err) => {
				this.homey.app.dError(`[${this.getName()}] Error caught while changing operation mode`, err);
			});
		}

		// capabilities
		this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
		this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));

		// conditions
		this.isHeatingCondition = await this.homey.flow.getConditionCard('mill_is_heating');
		this.isHeatingCondition
			.registerRunListener(() => (this.deviceData.switched_on === true));

		/*this.homey.setInterval(async () => {
			await this.refreshMillService();
		}, 5 * 1000);*/

		this.refreshTimeout = null;
		this.refreshState();
	}

	async refreshState() {
		this.log(`[${this.getName()}] Refreshing state`);

		if (this.refreshTimeout) {
			this.homey.clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}

		try {
			if (this.millApi.ping()) {
				await this.refreshMillService();
				this.setAvailable();
			} else {
				this.log(`[${this.getName()}] Mill not connected`);
				this.setUnavailable();
				await this.millApi.login(this.loginData.username, this.loginData.password).then(() => {
					this.scheduleRefresh(10);
				}).catch((err) => {
					this.homey.app.dError('Error caught while logging in', err);
				});
			}
		} catch (e) {
			this.homey.app.dError('Error caught while refreshing state', e);
		} finally {
			if (this.refreshTimeout === null) {
				this.scheduleRefresh();
			}
		}
	}

	async scheduleRefresh(interval) {
		const refreshInterval = interval || this.apiVersion == 'cloud' ? await this.homey.settings.get('interval') : 1;
		this.refreshTimeout = this.homey.setTimeout(this.refreshState.bind(this), refreshInterval * 1000);
		this.log(`[${this.getName()}] Next refresh in ${refreshInterval} seconds`);
	}

	async refreshMillService() {
		return this.millApi.getControlStatus(this.deviceInstance)
			.then(async (device) => {
				const currentTime = new Date().getTime();
				if (this.deviceType === 'cloud') {
					this.log(`[${this.getName()}] Mill state refreshed`, {
						ambTemp: device.ambient_temperature,
						hudmidity: device.humidity,
						currentPower: device.current_power,
						rawAmbTemp: device.raw_ambient_temperature,
						setTemp: device.set_temperature,
						switchedOn: device.switched_on,
						cloudConnected: device.connected_to_cloud,
						operationMode: device.operation_mode,
						status: device.status,
					});
				} else {
					// Logg kun en gang per 10 minutter (600000 ms)
					if (!this.lastLoggedTime || currentTime - this.lastLoggedTime >= 600000) {
						this.log(`[${this.getName()}] Mill state refreshed`, {
							ambTemp: device.ambient_temperature,
							hudmidity: device.humidity,
							currentPower: device.current_power,
							rawAmbTemp: device.raw_ambient_temperature,
							setTemp: device.set_temperature,
							switchedOn: device.switched_on,
							cloudConnected: device.connected_to_cloud,
							operationMode: device.operation_mode,
							status: device.status,
						});
						this.lastLoggedTime = currentTime;
					}
				}

				this.deviceData = device;

				if (device.operation_mode !== undefined) {
					const jobs = [
						this.setCapabilityValue('measure_temperature', device.ambient_temperature),
						this.setCapabilityValue('target_temperature', device.set_temperature < 4 ? this.lastSetTemperature : device.set_temperature),
						this.setCapabilityValue('mill_onoff', device.operation_mode !== 'OFF' && device.set_temperature > device.ambient_temperature),
						this.setCapabilityValue('onoff', device.operation_mode !== 'OFF')
					];

					this.lastSetTemperature = device.set_temperature > 4 ? device.set_temperature : this.lastSetTemperature;

					if (this.hasCapability('measure_power')) {
						const totalPowerUsage = device.current_power;
						//this.log(`Total power usage for ${this.getName()} ${totalPowerUsage}w`);
						jobs.push(await this.setCapabilityValue('measure_power', device.operation_mode !== 'OFF' ? totalPowerUsage : 0));
					}

					return Promise.all(jobs).catch((err) => {
						this.homey.app.dError(`[${this.getName()}] Error caught while refreshing state`, err.message);
					});
				}
			}).catch((err) => {
				this.homey.app.dError(`[${this.getName()}] Error caught while refreshing state`, err.message);
			});
	}

	async onAdded() {
		this.homey.app.dDebug('Device added', this.getState());
	}

	async onDeleted() {
		clearTimeout(this.refreshTimeout);
		this.homey.app.dDebug('Device deleted', this.getState());
	}

	async onSettings(oldSettings, newSettings, changedKeys) {
		if (changedKeys.includes('username') && changedKeys.includes('password')) {
			this.homey.app.dDebug('Username and password changed');
			this.homey.app.connectToMill();
		}
	}

	async onCapabilityTargetTemperature(value, opts) {
		this.log(`onCapabilityTargetTemperature(${value})`);
		//const temp = Math.ceil(value);
		const temp = value;
		if (temp !== value && this.deviceData.switched_on !== false) {
			await this.setCapabilityValue('target_temperature', temp);
			this.homey.app.dDebug(`onCapabilityTargetTemperature(${value}=>${temp})`);
		}

		this.millApi.setTemperature(temp, this.deviceInstance, this.deviceType)
			.then(() => {
				this.log(`onCapabilityTargetTemperature(${temp}) done`);
				this.homey.app.dDebug(`[${this.getName()}] Changed temp to ${temp}.`);
				this.scheduleRefresh(5);
			}).catch((err) => {
				this.log(`onCapabilityTargetTemperature(${temp}) error`);
				this.homey.app.dError(`[${this.getName()}] Change temp to ${temp} resultet in error`, err);
			});
	}

	async onCapabilityOnOff(value, opts) {
		let mode = value ? 'Control individually' : 'Off';
		this.millApi.setOperationMode(mode, this.deviceInstance, this.deviceType).then(() => {
			this.log(`onCapabilityOnOff(${value}) done`);
			this.homey.app.dDebug(`[${this.getName()}] Changed mode to ${mode}.`);
			this.scheduleRefresh(5);
		}).catch((err) => {
			this.log(`onCapabilityOnOff(${value}) error`);
			this.homey.app.dError(`[${this.getName()}] Change mode to ${mode} resultet in error`, err);
		});
	}
}

module.exports = MillDeviceV2;

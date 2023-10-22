'use strict';

const { Device } = require('homey');
const Room = require('../../lib/models');
const MillLocalAPI = require('../../lib/millLocal');

class MillDeviceV2 extends Device {
	async onInit() {
		this.homey.app.dDebug(`[${this.getName()}] (${this.deviceId}) initialized`);

		this.deviceId = this.getData().id;
		this.deviceData = {};

		if (this.getData().api === 'local') {
			this.millApi = new MillLocalAPI(this.getData().ip);
		} else {
			this.millApi = this.homey.app.getMillApi();
		}

		const operationMode = await this.millApi.getOperationMode();
		if (operationMode.mode !== 'Control individually') {
			this.log(`[${this.getName()}] Mill is not in Control individually mode. Changing now...`);
			await this.millApi.setOperationMode('Control individually').then((result) => {
				this.log(`[${this.getName()}] Mill is now in Control individually mode`, {
					response: result,
				});
			}).catch((err) => {
				this.homey.app.dError(`[${this.getName()}] Error caught while changing operation mode`, err);
			});
		}

		// Add new capailities for devices that don't have them yet
		if (!this.getCapabilities().includes('onoff')) {
			this.addCapability('onoff').catch(this.error);
		}
		if (!this.getCapabilities().includes('measure_power')) {
			this.addCapability('measure_power').catch(this.error);
		}
		// Remove old capabilities that are not used on the local API
		if (this.hasCapability('mill_mode')) {
			this.removeCapability('mill_mode').catch(this.error);
		}

		// capabilities
		this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
		this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));

		// conditions
		this.isHeatingCondition = await this.homey.flow.getConditionCard('mill_is_heating');
		this.isHeatingCondition
			.registerRunListener(() => (this.deviceData.switched_on === true));

		this.homey.setInterval(() => {
			this.refreshMillService();
		}, 5 * 1000);

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
				await this.homey.app.connectToMill().then(() => {
					this.scheduleRefresh(10);
				}).catch((err) => {
					this.homey.app.dError('Error caught while refreshing state', err);
				});
			}
		} catch (e) {
			this.homey.app.dError('Exception caught', e);
		} finally {
			if (this.refreshTimeout === null) {
				this.scheduleRefresh();
			}
		}
	}

	async scheduleRefresh(interval) {
		const refreshInterval = interval || this.homey.settings.get('interval');
		this.refreshTimeout = this.homey.setTimeout(this.refreshState.bind(this), refreshInterval * 1000);
		this.log(`[${this.getName()}] Next refresh in ${refreshInterval} seconds`);
	}

	async refreshMillService() {
		return this.millApi.getControlStatus()
			.then(async (device) => {
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

				this.deviceData = device;

				if (device.operation_mode !== undefined) {
					const jobs = [
						this.setCapabilityValue('measure_temperature', device.ambient_temperature),
						this.setCapabilityValue('target_temperature', device.set_temperature < 4 ? this.lastSetTemperature : device.set_temperature),
						this.setCapabilityValue('mill_onoff', device.operation_mode !== 'OFF' && device.set_temperature < device.ambient_temperature),
						this.setCapabilityValue('onoff', device.operation_mode !== 'OFF')
					];

					this.lastSetTemperature = device.set_temperature > 4 ? device.set_temperature : this.lastSetTemperature;

					if (this.hasCapability('measure_power')) {
						const totalPowerUsage = device.current_power;
						this.log(`Total power usage for ${this.getName()} ${totalPowerUsage}w`);
						jobs.push(await this.setCapabilityValue('measure_power', device.operation_mode !== 'OFF' ? totalPowerUsage : 0));
					}

					return Promise.all(jobs).catch((err) => {
						this.homey.app.dError(`[${this.getName()}] Error caught while refreshing state`, err);
					});
				}
			}).catch((err) => {
				this.homey.app.dError(`[${this.getName()}] Error caught while refreshing state`, err);
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

		this.millApi.setTemperature('Normal', temp)
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
		console.log()
		let mode = value ? 'Control individually' : 'Off';
		this.millApi.setOperationMode(mode).then(() => {
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

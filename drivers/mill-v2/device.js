'use strict';

const { Device } = require('homey');
const Room = require('../../lib/models');
const MillLocalAPI = require('../../lib/millLocal');

class MillDeviceV2 extends Device {
	async onInit() {
		this.log('MillDeviceV2 has been initialized');

		this.deviceId = this.getData().id;

		if (this.getData().api === 'local') {
			this.millApi = new MillLocalAPI(this.getData().ip);
		} else {
			this.millApi = this.homey.app.getMillApi();
		}

		this.log(`[${this.getName()}] ${this.getClass()} (${this.deviceId}) initialized`);

		// Add new capailities for devices that don't have them yet
		if (!this.getCapabilities().includes('onoff')) {
			this.addCapability('onoff').catch(this.error);
		}
		if (!this.getCapabilities().includes('measure_power')) {
			this.addCapability('measure_power').catch(this.error);
		}

		// capabilities
		this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
		this.registerCapabilityListener('mill_mode', this.onCapabilityThermostatMode.bind(this));
		this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));

		// triggers
		this.modeChangedTrigger = await this.homey.flow.getDeviceTriggerCard('mill_mode_changed');

		this.modeChangedToTrigger = await this.homey.flow.getDeviceTriggerCard('mill_mode_changed_to');
		this.modeChangedToTrigger
			.registerRunListener((args, state) => args.mill_mode === state.mill_mode);

		// conditions
		this.isHeatingCondition = await this.homey.flow.getConditionCard('mill_is_heating');
		this.isHeatingCondition
			.registerRunListener(() => (this.room.roomHeatStatus === true));

		this.isMatchingModeCondition = await this.homey.flow.getConditionCard('mill_mode_matching');
		this.isMatchingModeCondition
			.registerRunListener(args => (args.mill_mode.toLowerCase() === this.room.mode));

		// actions
		this.setProgramAction = await this.homey.flow.getActionCard('mill_set_mode');
		this.setProgramAction
			.registerRunListener((args) => {
				this.log(`[${args.device.getName()}] Flow changed mode to ${args.mill_mode}`);
				this.homey.app.dDebug(`[${args.device.getName()}] Flow changed mode to ${args.mill_mode}`);
				return args.device.setThermostatMode(args.mill_mode);
			});

		this.homey.setInterval(() => {
			this.updatePowerUsage();
		}, 300 * 1000);

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
			if (this.homey.app.isConnected()) {
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

				if (device.operation_mode !== undefined) {
					const jobs = [
						this.setCapabilityValue('measure_temperature', device.ambient_temperature),
						this.setCapabilityValue('mill_mode', device.operation_mode),
						this.setCapabilityValue('mill_onoff', device.switched_on),
						this.setCapabilityValue('onoff', device.switched_on !== 'off')
					];

					if (this.hasCapability('measure_power')) {
						const totalPowerUsage = device.current_power;
						this.log(`Total power usage for ${this.getName()} ${totalPowerUsage}w`);
						jobs.push(await this.setCapabilityValue('measure_power', device.switched_on ? totalPowerUsage : 0));
					}

					/*if (room.mode !== 'off') {
						switch (room.mode) {
							case 'weekly_program':
								jobs.push(this.setCapabilityValue('target_temperature', room.roomComfortTemperature));
								break;
							case 'comfort':
								jobs.push(this.setCapabilityValue('target_temperature', room.roomComfortTemperature));
								break;
							case 'sleep':
								jobs.push(this.setCapabilityValue('target_temperature', room.roomSleepTemperature));
								break;
							case 'away':
								jobs.push(this.setCapabilityValue('target_temperature', room.roomAwayTemperature));
								break;
							case 'vacation':
								jobs.push(this.setCapabilityValue('target_temperature', room.vacationTemperature));
								break;
							default:
								jobs.push(this.setCapabilityValue('target_temperature', room.averageTemperature));
								break;
						}
					}*/
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
		if (temp !== value && this.room.modeName !== 'Off') { // half degrees isn't supported by Mill, need to round it up
			await this.setCapabilityValue('target_temperature', temp);
			this.homey.app.dDebug(`onCapabilityTargetTemperature(${value}=>${temp})`);
		}
		const millApi = this.homey.app.getMillApi();

		if (this.room.modeName === 'Weekly_program') {
			this.room.roomComfortTemperature = temp;
		} else if (this.room.modeName === 'Comfort') {
			this.room.roomComfortTemperature = temp;
		} else if (this.room.modeName === 'Sleep') {
			this.room.roomSleepTemperature = temp;
		} else if (this.room.modeName === 'Away') {
			this.room.roomAwayTemperature = temp;
		} else if (this.room.modeName === 'Vacation') {
			this.room.vacationTemperature = temp;
		}

		millApi.changeRoomTemperature(this.deviceId, this.room)
			.then(() => {
				this.log(`onCapabilityTargetTemperature(${temp}) done`);
				this.homey.app.dDebug(`[${this.getName()}] Changed temp to ${temp}: mode: ${this.room.modeName}/${this.room.roomProgramName}, comfortTemp: ${this.room.roomComfortTemperature}, awayTemp: ${this.room.roomAwayTemperature}, avgTemp: ${this.room.averageTemperature}, sleepTemp: ${this.room.roomSleepTemperature}`);
				this.scheduleRefresh(7);
			}).catch((err) => {
				this.log(`onCapabilityTargetTemperature(${temp}) error`);
				this.homey.app.dError(`[${this.getName()}] Change temp to ${temp} resultet in error`, err);
			});
	}

	async setThermostatMode(value) {
		return new Promise(async (resolve, reject) => {
			const millApi = this.homey.app.getMillApi();
			this.room.modeName = value;
			const jobs = [];
			if (value !== 'off') {
				if (value === 'weekly_program') {
					switch (this.room.activeModeFromWeeklyProgram) {
						case 'comfort':
							jobs.push(await this.setCapabilityValue('target_temperature', this.room.roomComfortTemperature));
							break;
						case 'sleep':
							jobs.push(await this.setCapabilityValue('target_temperature', this.room.roomSleepTemperature));
							break;
						case 'away':
							jobs.push(await this.setCapabilityValue('target_temperature', this.room.roomAwayTemperature));
							break;
						case 'vacation':
							jobs.push(await this.setCapabilityValue('target_temperature', this.room.vacationTemperature));
							break;
					}
				} else if (value === 'comfort') {
					jobs.push(await this.setCapabilityValue('target_temperature', this.room.roomComfortTemperature));
				} else if (value === 'sleep') {
					jobs.push(await this.setCapabilityValue('target_temperature', this.room.roomSleepTemperature));
				} else if (value === 'away') {
					jobs.push(await this.setCapabilityValue('target_temperature', this.room.roomAwayTemperature));
				} else if (value === 'vacation') {
					jobs.push(await this.setCapabilityValue('target_temperature', this.room.vacationTemperature));
				}
			}
			jobs.push(millApi.changeRoomMode(this.deviceId, value.toLowerCase()));

			Promise.all(jobs).then(() => {
				this.homey.app.dDebug(`[${this.getName()}] Changed mode to ${value}: mode: ${value}/${this.room.roomProgramName}, comfortTemp: ${this.room.roomComfortTemperature}, awayTemp: ${this.room.roomAwayTemperature}, avgTemp: ${this.room.averageTemperature}, sleepTemp: ${this.room.roomSleepTemperature}`);
				this.scheduleRefresh(7);
				resolve(value);
			}).catch((err) => {
				this.homey.app.dError(`[${this.getName()}] Change mode to ${value} resulted in error`, err);
				reject(err);
			});
		});
	}

	async onCapabilityThermostatMode(value, opts) {
		this.log(`onCapabilityThermostatMode(${value})`);
		this.setThermostatMode(value)
			.then(result => this.log(result))
			.catch(err => this.log(err));
	}

	async onCapabilityOnOff(value, opts) {
		let mode = value ? 'weekly_program' : 'off';
		this.setThermostatMode(mode)
			.then(result => this.log(result))
			.catch(err => this.log(err));
	}
}

module.exports = MillDeviceV2;

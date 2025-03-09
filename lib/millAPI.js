'use strict';

const axios = require('axios');
const { EventEmitter } = require('events');

class MillAPI extends EventEmitter {
	constructor(app) {
		super();
		this.app = app;
	}

	// Mill Cloud methods
	async login() {
		throw new Error('login() is not available for local devices');
	}
	async processQueue() {
		throw new Error('processQueue() is not available for local devices');
	}
	async updateAccessToken() {
		throw new Error('updateAccessToken() is not available for local devices');
	}
	async request() {
		throw new Error('request() is not available for local devices');
	}
	async getCustomer() {
		throw new Error('getCustomer() is not available for local devices');
	}
	async updateControlSource() {
		throw new Error('updateControlSource() is not available for local devices');
	}
	async listHomes() {
		throw new Error('listHomes() is not available for local devices');
	}
	async listDevices() {
		throw new Error('listDevices() is not available for local devices');
	}
	async listIndependentDevices() {
		throw new Error('listIndependentDevices() is not available for local devices');
	}
	async getControlStatus() {
		throw new Error('getControlStatus() is not available for local devices');
	}
	async setTemperature() {
		throw new Error('setTemperature() is not available for local devices');
	}
	async changeRoomMode() {
		throw new Error('changeRoomMode() is not available for local devices');
	}
	async changeFanMode() {
		throw new Error('changeFanMode() is not available for local devices');
	}
	async checkMigrationStatus() {
		throw new Error('checkMigrationStatus() is not available for local devices');
	}
	async migrateCustomer() {
		throw new Error('migrateCustomer() is not available for local devices');
	}

	// Local device methods
	async checkOperationMode() {
		return "checkOperationMode() is not available for cloud devices";
	}
	async ping() {
		throw new Error('ping() is not available for cloud devices');
	}
	async getStatus() {
		throw new Error('getStatus() is not available for cloud devices');
	}
	async reboot() {
		throw new Error('reboot() is not available for cloud devices');
	}
	async getControlStatus() {
		throw new Error('getControlStatus() is not available for cloud devices');
	}
	async getOperationMode() {
		throw new Error('getOperationMode() is not available for cloud devices');
	}
	async setOperationMode(mode) {
		throw new Error('setOperationMode() is not available for cloud devices');
	}
	async getWeeklyProgram() {
		throw new Error('getWeeklyProgram() is not available for cloud devices');
	}
	async getDisplayUnit() {
		throw new Error('getDisplayUnit() is not available for cloud devices');
	}
	async setOilHeaterMaxPowerPercentage() {
		throw new Error('setOilHeaterMaxPowerPercentage() is not available for cloud devices');
	}
	async getOilHeaterMaxPowerPercentage() {
		throw new Error('getOilHeaterMaxPowerPercentage() is not available for cloud devices');
	}
	async getSetTemperature() {
		throw new Error('getSetTemperature() is not available for cloud devices');
	}
	async setTemperature() {
		throw new Error('setTemperature() is not available for cloud devices');
	}
	async overwriteWeeklyProgram() {
		throw new Error('overwriteWeeklyProgram() is not available for cloud devices');
	}
	async getVacationMode() {
		throw new Error('getVacationMode() is not available for cloud devices');
	}
	async setVacationMode() {
		throw new Error('setVacationMode() is not available for cloud devices');
	}
	async getTimezoneOffset() {
		throw new Error('getTimezoneOffset() is not available for cloud devices');
	}
	async getAdditionalSocketMode() {
		throw new Error('getAdditionalSocketMode() is not available for cloud devices');
	}
	async getCloudCommunication() {
		throw new Error('getCloudCommunication() is not available for cloud devices');
	}
	async setCloudCommunication(value) {
		throw new Error('setCloudCommunication() is not available for cloud devices');
	}
	async pingLocalDevice(ip) {
		throw new Error('pingLocalDevice() is not available for cloud devices');
	}
}

module.exports = MillAPI;
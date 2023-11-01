'use strict';

const { Driver } = require('homey');
const MillLocal = require('../../lib/millLocal');
const MillCloud = require('../../lib/millCloud');

class MillDriverV2 extends Driver {
	async onInit() {
		this.device = {};
		this.devices = [];

		this.MillCloud = new MillCloud(this.homey.app);
	}

	async onPair(session) {
		await session.setHandler('startPairing', async (data) => {
			this.homey.app.dDebug('Pairing started. Checking if user is logged in...');
			const connected = await this.homey.app.isConnected();
			this.homey.app.dDebug(connected ? 'User is logged in, continuing...' : 'User is not logged in, logging in...');
			return connected;
		});

		await session.setHandler('getUserInfo', async (data) => {
			const username = await this.homey.settings.get('username');
			const password = await this.homey.settings.get('password');

			if (!username || !password) {
				return { error: 'No username or password set' };
			}
			return { username, password };
		});

		await session.setHandler('login', async (data) => {
			const user = await this.homey.app.getUser();
			if (!user) {
				const result = await this.homey.app.authenticate(data.username, data.password);
				if (result === true) {
					await this.homey.settings.set('username', data.username);
					await this.homey.settings.set('password', data.password);
					return { success: true };
				} else {
					return { error: 'Login failed' };
				}
			} else {
				return { success: true };
			}
		});

		await session.setHandler('pingLocalDevice', async (data) => {
			this.MillLocal = new MillLocal(data);
			this.devices = [];

			const result = await this.MillLocal.pingLocalDevice(data);
			//console.log('result:', result);
			if (result.success === true) {
				const deviceType = result.data.name.toLowerCase().includes('socket') ? 'Sockets' : 'Heaters';
				const device = {
					name: result.data.name,
					data: {
						id: result.data.mac_address,
						name: result.data.name,
						deviceType: deviceType,
						macAddress: result.data.mac_address,
						ipAddress: data,
						apiVersion: 'local',
						houseId: 'Not applicable',
						homeName: 'Not applicable',
					},
					settings: {
						deviceType: deviceType,
						macAddress: result.data.mac_address,
						ipAddress: data,
						houseId: 'Not applicable',
						apiVersion: 'local',
					}
				};
				this.devices.push(device);

				return true;
			} else {
				return { error: 'Ping failed' };
			}
		});

		await session.setHandler('getCloudDevices', async (data) => {
			this.devices = [];

			const houses = await this.MillCloud.listHomes();

			for (const house of [...houses.ownHouses, ...houses.sharedHouses]) {
				const houseId = house.id;
				const houseName = house.name;

				const rooms = await this.MillCloud.listDevices(houseId);
				for (const room of rooms) {
					for (const device of room.devices) {
						const deviceType = device.deviceType.parentType.name;
						const deviceData = {
							name: device.customName,
							data: {
								id: device.deviceId,
								name: device.customName,
								deviceType: deviceType,
								macAddress: device.macAddress,
								ipAddress: 'Not applicable',
								apiVersion: 'cloud',
								houseId: houseId,
								homeName: houseName,
							},
							settings: {
								deviceType: deviceType,
								macAddress: device.macAddress,
								ipAddress: 'Not applicable',
								houseId: houseId,
								apiVersion: 'cloud',
							}
						};
						this.devices.push(deviceData);
					}
				}
			}

			if (this.devices.length > 0) {
				return { success: true, devices: this.devices };
			} else {
				return { error: 'No devices found' };
			}
		});

		await session.setHandler('getIndependentCloudDevices', async (data) => {
			this.devices = [];

			const houses = await this.MillCloud.listHomes();

			for (const house of [...houses.ownHouses, ...houses.sharedHouses]) {
				const houseId = house.id;
				const houseName = house.name;

				const devices = await this.MillCloud.listIndependentDevices(houseId, 'heatersAndSockets');
				//console.log('devices:', devices);
				for (const device of devices.items) {
					//console.log('device:', device);
					const deviceType = device.deviceType.parentType.name;
					const deviceData = {
						name: device.customName,
						data: {
							id: device.deviceId,
							name: device.customName,
							deviceType: deviceType,
							macAddress: device.macAddress,
							ipAddress: 'Not applicable',
							apiVersion: 'cloud',
							houseId: houseId,
							homeName: houseName,
						},
						settings: {
							deviceType: deviceType,
							macAddress: device.macAddress,
							ipAddress: 'Not applicable',
							houseId: houseId,
							apiVersion: 'cloud',
						}
					};
					this.devices.push(deviceData);
					//console.log('this.devices:', this.devices);

					return { success: true, devices: this.devices.length }
				}
			}
			return { error: 'No devices found' };
		});

		session.setHandler("list_devices", async () => {
			return await this.onPairListDevices(session);
		});
	}

	async onPairListDevices() {
		this.homey.app.dDebug('Devices ready to be added:', this.devices);
		return this.devices;
	}
}

module.exports = MillDriverV2;

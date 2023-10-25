'use strict';

const { Driver } = require('homey');
const MillLocal = require('../../lib/millLocal');
const MillCloud = require('../../lib/millCloud');

class MillDriverV2 extends Driver {
	async onInit() {
		this.device = {};
		this.devices = [];
	}

	async onPair(session) {
		await session.setHandler('startPairing', async (data) => {
			this.homey.app.dDebug('Pairing started. Checking if user is logged in...');
			const connected = await this.homey.app.isConnected();
			//console.log('connected:', connected);
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

			const result = await this.MillLocal.pingLocalDevice(data);
			console.log('result:', result);
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
			this.MillCloud = new MillCloud(this.homey.app);

			const house = await this.MillCloud.listHomes();
			const houseId = house.ownHouses[0].id;
			const houseName = house.ownHouses[0].name;

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

					return deviceData.length;
				}
			}
			return { error: 'No devices found' };
		});

		await session.setHandler('getIndependentCloudDevices', async (data) => {
			this.MillCloud = new MillCloud(this.homey.app);

			const house = await this.MillCloud.listHomes();
			const houseId = house.ownHouses[0].id;
			const houseName = house.ownHouses[0].name;

			const devices = await this.MillCloud.listIndependentDevices(houseId, 'heatersAndSockets');
			for (const device of devices.items) {
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

				return deviceData.length;
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

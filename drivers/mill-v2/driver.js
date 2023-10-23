'use strict';

const { Driver } = require('homey');
const millLocal = require('../../lib/millLocal');
const millCloud = require('../../lib/millCloud');

class MillDriverV2 extends Driver {
	async onInit() {
		this.device = {};
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
			const result = await this.homey.app.authenticate(data.username, data.password);
			if (result === true) {
				await this.homey.settings.set('username', data.username);
				await this.homey.settings.set('password', data.password);
				return { success: true };
			} else {
				return { error: 'Login failed' };
			}
		});

		await session.setHandler('pingLocalDevice', async (data) => {
			this.millLocal = new millLocal(data);

			const result = await this.millLocal.pingLocalDevice(data);
			console.log('result:', result);
			if (result.success === true) {
				this.device = {
					name: result.data.name,
					data: {
						ip: data,
						mac: result.data.mac,
						api: 'local'
					}
				};
				return true;
			} else {
				return { error: 'Ping failed' };
			}
		});

		await session.setHandler('getCloudDevices', async (data) => {
			this.millCloud = new millCloud(this.homey.app);

			const house = await this.millCloud.listHomes();
			console.log('house:', house);
			const houseId = house.ownHouses[0].id;
			console.log('houseId:', houseId);

			const devices = await this.millCloud.listDevices(houseId);
			console.log('devices:', devices);
			if (devices) {
				return devices;
			} else {
				return { error: 'No devices found' };
			}
		});
		
		session.setHandler("list_devices", async () => {
			return await this.onPairListDevices(session);
		});
	}

	async onPairListDevices() {
		const devices = [];
		const device = {
			name: this.device.name,
			data: this.device.data,
		};

		devices.push(device);
		return devices;
	}
}

module.exports = MillDriverV2;

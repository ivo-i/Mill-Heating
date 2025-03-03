'use strict';

const { Device } = require('homey');
const Room = require('../../lib/models');
const MillLocal = require('../../lib/millLocal');
const MillCloud = require('../../lib/millCloud');

class MillDeviceV2 extends Device {
    async onInit() {
        this.deviceId = this.getData().id;
        this.deviceName = this.getData().name;
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
        this.lastLoggedTime2 = null;
        this.lastLoggedTime3 = null;
        this.lastLoggedTime4 = null;

        if (this.getData().apiVersion === 'local') {
            this.millApi = new MillLocal(this.ipAddress);
            this.deviceInstance = this.ipAddress;
        } else {
            this.millApi = new MillCloud(this.homey.app);
            this.deviceInstance = this.deviceId;
        }
        if (!this.getCapabilities().includes('measure_power')) {
            this.addCapability('measure_power').catch(this.error);
        }

        // capabilities
        this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
        this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));

        this.log(`[${this.getName()}] --- Device initialized`, this.deviceName);
        if (this.deviceName.includes('HeaterGen3Oil')) {
            this.log(`[${this.getName()}] --- Device set capability Power Mode: `, this.deviceName);
            await this.addCapability('mill_gen3oil_power_mode').catch(this.error);
            this.registerCapabilityListener('mill_gen3oil_power_mode', this.onCapabilityPowerMode.bind(this));
        } else {    
            //remove capability mill_gen3oil_power_mode if it exists
            this.removeCapability('mill_gen3oil_power_mode');
        }
            // conditions
        this.isHeatingCondition = await this.homey.flow.getConditionCard('mill_is_heating');
        this.isHeatingCondition
            .registerRunListener(() => (this.deviceData.switched_on === true));

        /*this.homey.setInterval(async () => {
            await this.refreshMillService();
        }, 5 * 1000);*/

        this.refreshTimeout = null;
        this.refreshState();

        this.millApi.on('operationMode', async (mode) => {
            this.homey.app.dDebug(`[${this.getName()}] changed operation mode to ${mode}.`);

            if (mode !== 'Control individually' && mode !== 'control_individually') {
                this.homey.app.dDebug(`[${this.getName()}] is no longer in "Control individually" mode. Changing now...`);

                await this.millApi.setOperationMode('Control individually', this.deviceInstance, this.deviceType).then((result) => {
                    this.homey.app.dDebug(`[${this.getName()}] Mill ${this.getName()} is now in Control individually mode`, {
                        response: result,
                    });
                }).catch((err) => {
                    this.homey.app.dError(`[${this.getName()}] Error caught while changing operation mode`, err);
                });
            }
        });

        this.millApi.on('connectionLost', async (message) => {
            const now = new Date().getTime();
            if (!this.lastLoggedTime4 || now - this.lastLoggedTime4 >= 600000) {
                this.homey.app.dDebug(`[${this.getName()}] Mill connection lost`);
                if (message) {
                    this.homey.app.dError(`[${this.getName()}] ${message}`);
                }
                this.lastLoggedTime4 = now;
                this.homey.clearInterval(this.refreshTimeout);
                return await this.setUnavailable('Connection lost. Please check your local network connection to the Mill heater. If the problem persists, please restart the app.');
            }
        });

        this.millApi.on('connectionEstablished', async () => {
            this.homey.app.dDebug(`[${this.getName()}] Mill connection established/restored. Refreshing state...`);
            await this.setAvailable();
            return await this.scheduleRefresh();
        });

        this.homey.app.dDebug(`[${this.getName()}] (${this.deviceId}) initialized`);
    }

    async refreshState() {
        const currentTime = new Date().getTime();
        if (this.deviceType === 'cloud') {
            this.homey.app.dDebug(`[${this.getName()}] Refreshing state`);
        } else {
            // Logg kun en gang per 10 minutter (600000 ms)
            if (!this.lastLoggedTime2 || currentTime - this.lastLoggedTime2 >= 600000) {
                this.homey.app.dDebug(`[${this.getName()}] Refreshing state`);
                this.lastLoggedTime2 = currentTime;
            }
        }

        if (this.refreshTimeout) {
            this.homey.clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }

        try {
            if (this.millApi.ping()) {
                await this.refreshMillService();
                this.setAvailable();
            } else {
                this.homey.app.dDebug(`[${this.getName()}] Mill not connected`);
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

        const currentTime = new Date().getTime();
        if (this.deviceType === 'cloud') {
            this.homey.app.dDebug(`[${this.getName()}] Next refresh in ${refreshInterval} seconds`);
        } else {
            // Logg kun en gang per 10 minutter (600000 ms)
            if (!this.lastLoggedTime3 || currentTime - this.lastLoggedTime3 >= 600000) {
                this.homey.app.dDebug(`[${this.getName()}] Next refresh in ${refreshInterval} seconds`);
                this.lastLoggedTime3 = currentTime;
            }
        }
    }

    async refreshMillService() {
        return this.millApi.getControlStatus(this.deviceInstance)
            .then(async (device) => {
                if (this.deviceType === 'cloud') {
                    this.homey.app.dDebug(`[${this.getName()}] Mill state refreshed`, {
                        ambTemp: device.ambient_temperature,
                        humidity: device.humidity,
                        currentPower: device.current_power,
                        rawAmbTemp: device.raw_ambient_temperature,
                        setTemp: device.set_temperature,
                        switchedOn: device.switched_on,
                        cloudConnected: device.connected_to_cloud,
                        operationMode: device.operation_mode,
                        status: device.status,
                        controlSource: device.control_source,
                    });
                } else {
                    // Logg kun en gang per 10 minutter (600000 ms)
                    const currentTime = new Date().getTime();
                    if (!this.lastLoggedTime || currentTime - this.lastLoggedTime >= 600000) {
                        this.homey.app.dDebug(`[${this.getName()}] Mill state refreshed`, {
                            ambTemp: device.ambient_temperature,
                            humidity: device.humidity,
                            currentPower: device.current_power,
                            rawAmbTemp: device.raw_ambient_temperature,
                            setTemp: device.set_temperature,
                            switchedOn: device.switched_on,
                            cloudConnected: device.connected_to_cloud,
                            controlSignal: device.control_signal,
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
                        this.setCapabilityValue('mill_onoff', device.operation_mode !== 'OFF' && device.control_signal > 0),
                        this.setCapabilityValue('onoff', device.operation_mode !== 'OFF'),
                        this.setCapabilityValue('measure_power', device.operation_mode !== 'OFF' ? device.current_power : 0)
                    ];

                    if  (this.deviceName.includes('HeaterGen3Oil')) {
                        const oilHeaterPowerData = await this.millApi.getOilHeaterPowerMode();
                        device.oilHeaterPowerMode = String(oilHeaterPowerData.value);
                        jobs.push(this.setCapabilityValue('mill_gen3oil_power_mode', device.oilHeaterPowerMode));
                        this.log(`[${this.getName()}] State refreshed`,device)
                    }

                    this.lastSetTemperature = device.set_temperature > 4 ? device.set_temperature : this.lastSetTemperature || 21;

                    // if (this.hasCapability('measure_power')) {
                    //     const totalPowerUsage = device.current_power;
                    //     //this.homey.app.dDebug(`Total power usage for ${this.getName()} ${totalPowerUsage}w`);
                    //     this.log(`[${this.getName()}] set power to`,device.current_power)
                    //     jobs.push(await this.setCapabilityValue('measure_power', device.operation_mode !== 'OFF' ? totalPowerUsage : 0));
                    // }

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
        this.log('Device mill_gen3oil_power_mode added with name ',this.getName());

        if (this.getData().name.includes('HeaterGen3Oil')) {
            this.log('Adding capability mill_gen3oil_power_mode to ',this.getName());
            await this.addCapability('mill_gen3oil_power_mode').catch(this.error);
        } else {    
            this.removeCapability('mill_gen3oil_power_mode');
        }
    }

    async onDeleted() {
        clearTimeout(this.refreshTimeout);
        this.homey.app.dDebug('Device deleted', this.getState());
    }

    async onSettings(oldSettings, newSettings, changedKeys) {
        if (changedKeys && changedKeys.includes('username') && changedKeys.includes('password')) {
            this.homey.app.dDebug('Username and password changed');
            this.homey.app.connectToMill();
        } else if (changedKeys && changedKeys.includes('ipAddress')) {
            this.homey.app.dDebug('IP address changed');
            this.millApi = new MillLocal(newSettings.ipAddress);
            this.deviceInstance = newSettings.ipAddress;
            await this.scheduleRefresh();
        }
    }

    async onCapabilityPowerMode(value, opts) {
        this.log(`onCapabilityPowerMode(${value})`);
        //const temp = Math.ceil(value);
        const power = value;
        if (power !== value && this.deviceData.switched_on !== false) {
            await this.setCapabilityValue('mill_gen3oil_power_mode', power);
            this.homey.app.dDebug(`onCapabilityPowerMode(${value}=>${power})`);
        }

        this.millApi.setOilHeaterPowerMode(power, this.deviceInstance, this.deviceType)
            .then(async () => {
                this.log(`onCapabilityPowerMode(${power}) done`);
                this.homey.app.dDebug(`[${this.getName()}] Changed power mode to ${power}.`);
                // await this.scheduleRefresh(2);
                await this.refreshMillService();
            }).catch((err) => {
                this.log(`onCapabilityPowerMode(${power}) error`);
                this.homey.app.dError(`[${this.getName()}] Change power mode to ${power} resulted in error`, err);
            });
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
            .then(async () => {
                this.log(`onCapabilityTargetTemperature(${temp}) done`);
                this.homey.app.dDebug(`[${this.getName()}] Changed temp to ${temp}.`);
                await this.refreshMillService;
            }).catch((err) => {
                this.log(`onCapabilityTargetTemperature(${temp}) error`);
                this.homey.app.dError(`[${this.getName()}] Change temp to ${temp} resulted in error`, err);
            });
    }

    async onCapabilityOnOff(value, opts) {
        let mode = value ? 'Control individually' : 'Off';
        this.millApi.setOperationMode(mode, this.deviceInstance, this.deviceType)
            .then(async () => {
                this.log(`onCapabilityOnOff(${value}) done`);
                this.homey.app.dDebug(`[${this.getName()}] Changed mode to ${mode}.`);
                await this.refreshMillService;
            }).catch((err) => {
                this.log(`onCapabilityOnOff(${value}) error`);
                this.homey.app.dError(`[${this.getName()}] Change mode to ${mode} resulted in error`, err);
            });
    }
}

module.exports = MillDeviceV2;

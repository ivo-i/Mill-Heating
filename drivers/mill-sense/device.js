'use strict';

const { Device } = require('homey');
const { error } = require('./../../lib/util');
const Room = require('./../../lib/models');

class MillSense extends Device {
  async onInit() {
    this.deviceId = this.getData().id;
    this.millApi = this.homey.app.getMillApi();
    this.device = this.millApi.getDevice(this.deviceId);

    this.log(`[${this.getName()}] ${this.getClass()} (${this.deviceId}) initialized`);

    // Add new capailities for devices that don't have them yet
    if (!this.hasCapability('measure_temperature')) {
      this.addCapability('measure_temperature');
    }
    if (!this.hasCapability('measure_humidity')) {
      this.addCapability('measure_humidity');
    }
    if (!this.hasCapability('measure_co2')) {
      this.addCapability('measure_co2');
    }
    if (!this.hasCapability('measure_pm25')) {
      this.addCapability('measure_pm25');
    }
    if (!this.hasCapability('measure_battery')) {
      this.addCapability('measure_battery');
    }

    this.refreshTimeout = null;
    this.millApi = null;
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
          error('Error caught while refreshing state', err);
        });
      }
    } catch (e) {
      error('Exception caught', e);
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
    const millApi = this.homey.app.getMillApi();
    return millApi.getDevice(this.getData().id)
      .then(async (device) => {
        this.log(`[${this.getName()}] Mill state refreshed`, {
          temperature: device.lastMetrics.temperature,
          humidity: device.lastMetrics.humidity,
          co2: device.lastMetrics.eco2,
          pm25: device.lastMetrics.tvoc,
          battery: device.lastMetrics.batteryPercentage,
        });
        await this.setCapabilityValue('measure_temperature', device.lastMetrics.temperature);
        await this.setCapabilityValue('measure_humidity', device.lastMetrics.humidity);
        await this.setCapabilityValue('measure_co2', device.lastMetrics.eco2);
        await this.setCapabilityValue('measure_pm25', device.lastMetrics.tvoc);
        await this.setCapabilityValue('measure_battery', device.lastMetrics.batteryPercentage);
      }).catch((err) => {
        error('Error caught while refreshing state', err);
      });
  }

  async onAdded() {
    this.log('device added', this.getState());
  }

  async onDeleted() {
    clearTimeout(this.refreshTimeout);
    this.log('device deleted', this.getState());
  }

  async onSettings(oldSettings, newSettings, changedKeys) {
    this.log('onSettings', oldSettings, newSettings, changedKeys);
    if (changedKeys.includes('username') && changedKeys.includes('password')) {
      this.log('onSettings', 'username and password changed');
      this.homey.app.connectToMill();
    }
  }

}

module.exports = MillSense;

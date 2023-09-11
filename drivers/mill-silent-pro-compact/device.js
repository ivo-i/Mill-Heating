'use strict';

const { Device } = require('homey');

class MillSilentProCompact extends Device {
  async onInit() {
    this.deviceId = this.getData().id;
    this.millApi = this.homey.app.getMillApi();
    this.device = this.millApi.getDevice(this.deviceId);

    this.log(`[${this.getName()}] ${this.getClass()} (${this.deviceId}) initialized`);

    // Add new capailities for devices that don't have them yet

    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff').catch(this.error);
    }
    if (!this.hasCapability('mill_silent_pro_mode')) {
      await this.addCapability('mill_silent_pro_mode').catch(this.error);
    }
    if (!this.hasCapability('measure_temperature')) {
      await this.addCapability('measure_temperature');
    }
    if (!this.hasCapability('measure_humidity')) {
      await this.addCapability('measure_humidity');
    }
    if (!this.hasCapability('measure_tvoc_pm1')) {
      await this.addCapability('measure_tvoc_pm1');
    }
    if (!this.hasCapability('measure_tvoc_pm2_5')) {
      await this.addCapability('measure_tvoc_pm2_5');
    }    
    if (!this.hasCapability('measure_tvoc_pm10')) {
      await this.addCapability('measure_tvoc_pm10');
    }
    if (!this.hasCapability('alarm_temperature')) {
      await this.addCapability('alarm_temperature');
    }   
    if (!this.hasCapability('alarm_humidity')) {
      await this.addCapability('alarm_humidity');
    }
    if (!this.hasCapability('alarm_tvoc')) {
      await this.addCapability('alarm_tvoc');
    }
    if (!this.hasCapability('alarm_filter_status')) {
      await this.addCapability('alarm_filter_status');
    }

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('mill_silent_pro_mode', this.onCapabilityFanMode.bind(this));

    
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
          this.scheduleRefresh(5);
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
    const millApi = this.homey.app.getMillApi();
    return millApi.getDevice(this.getData().id)
      .then(async (device) => {
        this.log(`[${this.getName()}] Mill state refreshed`, {
          temperature: device.lastMetrics.temperature,
          humidity: device.lastMetrics.humidity,
          tvoc_pm1: device.lastMetrics.massPm_10,
          tvoc_pm2_5: device.lastMetrics.massPm_25,
          tvoc_pm10: device.lastMetrics.massPm_100,
          fan_speed_mode: device.deviceSettings.reported.fan_speed_mode,
        });

        await this.setCapabilityValue('onoff', device.deviceSettings.reported.fan_speed_mode !== 'SOFT_OFF' && 
                                               device.deviceSettings.reported.fan_speed_mode !== 'HARD_OFF');

        switch (device.deviceSettings.reported.fan_speed_mode) {
          case 'HARD_OFF': 
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'SOFT_OFF': 
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'AUTO':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'SLEEP':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'BOOST':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL1':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL2':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL3':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL4':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL5':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL6':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          case 'MANUAL_LEVEL7':
            await this.setCapabilityValue('mill_silent_pro_mode', device.deviceSettings.reported.fan_speed_mode);
            break;
          // default:
          //   await this.setCapabilityValue('mill_silent_pro_mode', "AUTO");
          //   break;
        }
        if (device.isEnabled == false ) {
              await this.setCapabilityValue('measure_temperature', 0);
              await this.setCapabilityValue('measure_humidity', 0);
              await this.setCapabilityValue('measure_tvoc_pm1', 0);
              await this.setCapabilityValue('measure_tvoc_pm2_5', 0);
              await this.setCapabilityValue('measure_tvoc_pm10', 0);
              await this.setCapabilityValue('alarm_temperature', false);
              await this.setCapabilityValue('alarm_humidity', false);
              await this.setCapabilityValue('alarm_tvoc', false);
              await this.setCapabilityValue('alarm_filter_status', false);
        } else {
          await this.setCapabilityValue('measure_temperature', device.lastMetrics.temperature);
          await this.setCapabilityValue('measure_humidity', device.lastMetrics.humidity);
          await this.setCapabilityValue('measure_tvoc_pm1', device.lastMetrics.massPm_10);
          await this.setCapabilityValue('measure_tvoc_pm2_5', device.lastMetrics.massPm_25);
          await this.setCapabilityValue('measure_tvoc_pm10', device.lastMetrics.massPm_100);

          if ((device.lastMetrics.temperature != 0 &&            
              device.lastMetrics.temperature <= 5 ) ||
              device.lastMetrics.temperature >= 35 ) {
            await this.setCapabilityValue('alarm_temperature', true);
          } else {
            await this.setCapabilityValue('alarm_temperature', false);
          }
          if ((device.lastMetrics.humidity != 0 &&
              device.lastMetrics.humidity <= 25 ) ||
              device.lastMetrics.humidity >= 70  ) {
            await this.setCapabilityValue('alarm_humidity', true);
          } else {
            await this.setCapabilityValue('alarm_humidity', false);
          }
          if (device.lastMetrics.massPm_10 >= 150 || 
              device.lastMetrics.massPm_25 >= 150 || 
              device.lastMetrics.massPm_100 >= 150 ) {
            await this.setCapabilityValue('alarm_tvoc', true);
          } else {
            await this.setCapabilityValue('alarm_tvoc', false);
          }
          if (device.deviceSettings.reported.filter_state != "OK" ) {
            await this.setCapabilityValue('alarm_filter_status', true);
          } else {
            await this.setCapabilityValue('alarm_filter_status', false);
          }
        }
      }).catch((err) => {
        this.homey.app.dError('Error caught while refreshing state', err);
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
    this.log('onSettings', oldSettings, newSettings, changedKeys);
    if (changedKeys.includes('username') && changedKeys.includes('password')) {
      this.homey.app.dDebug('Username and password changed');
      this.homey.app.connectToMill();
    }
  }

  async setFanMode(value) {
    return new Promise(async (resolve, reject) => {
      const millApi = this.homey.app.getMillApi();
      const jobs = [];
      jobs.push(millApi.changeFanMode(this.deviceId ,value));

      Promise.all(jobs).then(() => {
        this.homey.app.dDebug(`[${this.getName()}] Changed mode to ${value}`);
        this.scheduleRefresh(2);
        resolve(value);
      }).catch((err) => {
        this.homey.app.dError(`[${this.getName()}] Change mode to ${value} resulted in error`, err);
        reject(err);
      });
    });
  }

  async onCapabilityFanMode(value, opts) {
    let mode = (value === 'HARD_OFF') ? 'SOFT_OFF' : value;
    this.log(`onCapabilityFanMode(${value}, ${mode})`);
    this.setFanMode(mode)
      .then(result => this.log(result))
      .catch(err => this.log(err));
  }

  async onCapabilityOnOff(value, opts) {
    let mode = value ? 'AUTO' : 'SOFT_OFF';
    this.log(`onCapabilityOnOff(${value}, ${mode})`);
    this.setFanMode(mode)
      .then(result => this.log(result))
      .catch(err => this.log(err));
  }
  // deviceSettings.reported.fan_speed_mode : HARD_OFF SOFT_OFF AUTO  SLEEP BOOST MANUAL_LEVEL1 - MANUAL_LEVEL7

}

module.exports = MillSilentProCompact;

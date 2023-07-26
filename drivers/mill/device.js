'use strict';

const { Device } = require('homey');
const Homey = require('homey');
const { Log } = require('./../../lib/log');
const { debug, error } = require('./../../lib/util');
const Room = require('./../../lib/models');

class MillDevice extends Device {
  async onInit() {
    this.deviceId = this.getData().id;

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
      .registerRunListener(() => (this.room && this.room.heatStatus === 1));

    this.isMatchingModeCondition = await this.homey.flow.getConditionCard('mill_mode_matching');
    this.isMatchingModeCondition
      .registerRunListener(args => (args.mill_mode === this.room.modeName));

    // actions
    this.setProgramAction = await this.homey.flow.getActionCard('mill_set_mode');
    this.setProgramAction
      .registerRunListener((args) => {
        this.log(`[${args.device.getName()}] Flow changed mode to ${args.mill_mode}`);
        return args.device.setThermostatMode(args.mill_mode);
      });

    this.refreshTimeout = null;
    this.room = null;
    this.refreshState();
  }

  async refreshState() {
    this.log(`[${this.getName()}] Refreshing state`);

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
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

    return millApi.listDevices(this.getData().id)
      .then((room) => {
        this.log(`[${this.getName()}] Mill state refreshed`, {
          comfortTemp: room.roomComfortTemperature,
          awayTemp: room.roomAwayTemperature,
          sleepTemp: room.roomSleepTemperature,
          avgTemp: room.averageTemperature,
          mode: room.mode,
          programMode: room.roomProgramName,
          heatStatus: room.roomHeatStatus
        });

        if (room.roomProgramName !== undefined) {
          if (this.room && !this.room.modesMatch(room) && this.room.mode !== room.mode) {
            this.log(`[${this.getName()}] Triggering mode change from ${this.room.mode} to ${room.mode}`);
            this.modeChangedToTrigger.trigger(this, null, { mill_mode: room.mode })
              .catch(this.error);
          }

          this.room = new Room(room);
          const jobs = [
            this.setCapabilityValue('measure_temperature', room.averageTemperature),
            this.setCapabilityValue('mill_mode', room.mode),
            this.setCapabilityValue('mill_onoff', room.roomHeatStatus),
            this.setCapabilityValue('onoff', room.mode !== 'off')
          ];

          if (this.hasCapability('measure_power')) {
            const settings = this.getSettings();
            if (settings.energy_consumption > 0)
              jobs.push(this.setCapabilityValue('measure_power', this.room.roomHeatStatus ? settings.energy_consumption : 2));
          }

          if (room.mode !== 'off') {
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
          }
          return Promise.all(jobs).catch((err) => {
            error(`[${this.getName()}] Error caught while refreshing state`, err);
          });
        }
      }).catch((err) => {
        error(`[${this.getName()}] Error caught while refreshing state`, err);
      });
  }

  async onAdded() {
    this.log('device added', this.getState());
  }

  async onDeleted() {
    clearTimeout(this.refreshTimeout);
    this.log('device deleted', this.getState());
  }

  async onCapabilityTargetTemperature(value, opts) {
    this.log(`onCapabilityTargetTemperature(${value})`);
    const temp = Math.ceil(value);
    if (temp !== value && this.room.modeName !== 'off') { // half degrees isn't supported by Mill, need to round it up
      this.setCapabilityValue('target_temperature', temp);
      this.log(`onCapabilityTargetTemperature(${value}=>${temp})`);
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
        this.log(`[${this.getName()}] Changed temp to ${temp}: mode: ${this.room.modeName}/${this.room.roomProgramName}, comfortTemp: ${this.room.roomComfortTemperature}, awayTemp: ${this.room.roomAwayTemperature}, avgTemp: ${this.room.averageTemperature}, sleepTemp: ${this.room.roomSleepTemperature}`);
        this.log(temp);
      }).catch((err) => {
        this.log(`onCapabilityTargetTemperature(${temp}) error`);
        this.log(`[${this.getName()}] Change temp to ${temp} resultet in error`, err);
        this.log(err);
      });
  }

  async setThermostatMode(value) {
    return new Promise((resolve, reject) => {
      const millApi = this.homey.app.getMillApi();
      this.room.modeName = value;
      const jobs = [];
      if (value !== 'off') {
        if (value === 'weekly_program') {
          switch (this.room.activeModeFromWeeklyProgram) {
            case 'comfort':
              jobs.push(this.setCapabilityValue('target_temperature', this.room.roomComfortTemperature));
              break;
            case 'sleep':
              jobs.push(this.setCapabilityValue('target_temperature', this.room.roomSleepTemperature));
              break;
            case 'away':
              jobs.push(this.setCapabilityValue('target_temperature', this.room.roomAwayTemperature));
              break;
          }
        } else if (value === 'comfort') {
          jobs.push(this.setCapabilityValue('target_temperature', this.room.roomComfortTemperature));
        } else if (value === 'sleep') {
          jobs.push(this.setCapabilityValue('target_temperature', this.room.roomSleepTemperature));
        } else if (value === 'away') {
          jobs.push(this.setCapabilityValue('target_temperature', this.room.roomAwayTemperature));
        } else if (value === 'vacation') {
          jobs.push(this.setCapabilityValue('target_temperature', this.room.vacationTemperature));
        }
      }
      jobs.push(millApi.changeRoomMode(this.deviceId, value.toLowerCase()));

      Promise.all(jobs).then(() => {
        this.log(`[${this.getName()}] Changed mode to ${value}: mode: ${value}/${this.room.roomProgramName}, comfortTemp: ${this.room.roomComfortTemperature}, awayTemp: ${this.room.roomAwayTemperature}, avgTemp: ${this.room.averageTemperature}, sleepTemp: ${this.room.roomSleepTemperature}`);
        resolve(value);
      }).catch((err) => {
        error(`[${this.getName()}] Change mode to ${value} resulted in error`, err);
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

module.exports = MillDevice;

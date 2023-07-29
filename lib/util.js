'use strict';

const axios = require('axios');

class Util {
  constructor(homey) {
    this.homey = homey;
  }

  dLog = async (severity, message, data) => {
    console.log('this.homey', this.homey);
    console.log('this.homey.settings', this.homey.settings);

    if (!this.homey) {
      console.log(`${severity}: ${message}`, data || '');
      return;
    }

    if (this.homey.settings.get('debug')) {
      const debugLog = this.homey.settings.get('debugLog') || [];
      const entry = { registered: new Date().toLocaleString(), severity, message };
      if (data) {
        if (typeof data === 'string') {
          entry.data = { data };
        } else if (data.message) {
          entry.data = { error: data.message, stacktrace: data.stack };
        } else {
          entry.data = data;
        }
      }

      debugLog.push(entry);
      if (debugLog.length > 100) {
        debugLog.splice(0, 1);
      }
      this.homey.log(`${severity}: ${message}`, data || '');
      this.homey.settings.set('debugLog', debugLog);
      this.homey.api.realtime('debugLog', entry);
    }
  }

  dDebug = async (message, data) => {
    await this.dLog('DEBUG', message, data);
  }

  dWarn = async (message, data) => {
    await this.dLog('WARN', message, data);
  }

  dError = async (message, data) => {
    await this.dLog('ERROR', message, data);
  }

  fetchJSON = async (endpoint, options) => {
    try {
      const response = await axios(endpoint, options);
      return response.data;
    } catch (e) {
      return {
        error: e.message || e
      };
    }
  }
}

module.exports = Util;
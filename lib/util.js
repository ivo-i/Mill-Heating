'use strict';

const axios = require('axios');

class Util {
  async log(severity, message, data) {
    // Homey will not be available in tests
    if (!Homey) {
      console.log(`${severity}: ${message}`, data || '');
      return;
    }

    this.log(Homey.settings);

    /*if (Homey.App.settings.get('debug')) {
      const debugLog = Homey.App.settings.get('debugLog') || [];
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
      Homey.App.log(`${severity}: ${message}`, data || '');
      Homey.App.settings.set('debugLog', debugLog);
      Homey.App.api.realtime('debugLog', entry);
    }*/
  };

  async debug(message, data) {
    await this.log('DEBUG', message, data);
  }

  async warn(message, data) {
    await this.log('WARN', message, data);
  }

  async error(message, data) {
    await this.log('ERROR', message, data);
  }

  async fetchJSON(endpoint, options) {
    try {
      const result = await axios(endpoint, options);
      const text = await result.text();
      return text.length > 0 ? JSON.parse(text) : {};
    } catch (e) {
      return {
        error: e.message || e
      };
    }
  }
};

module.exports = new Util();
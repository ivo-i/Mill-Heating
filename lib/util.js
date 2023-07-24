'use strict';

const Homey = require('homey');
const axios = require('axios');

const log = (severity, message, data) => {
  // Homey will not be available in tests
  if (!Homey) {
    console.log(`${severity}: ${message}`, data || '');
    return;
  }

  if (Homey.homey.settings.get('debug')) {
    const debugLog = Homey.homey.settings.get('debugLog') || [];
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
    Homey.homey.log(`${severity}: ${message}`, data || '');
    Homey.homey.settings.set('debugLog', debugLog);
    Homey.homey.api.realtime('debugLog', entry);
  }
};

const debug = (message, data) => {
  log('DEBUG', message, data);
};

const warn = (message, data) => {
  log('WARN', message, data);
};

const error = (message, data) => {
  log('ERROR', message, data);
};

const fetchJSON = async (endpoint, options) => {
  try {
    const result = await axios(endpoint, options);
    const text = await result.text();
    return text.length > 0 ? JSON.parse(text) : {};
  } catch (e) {
    return {
      error: e.message || e
    };
  }
};

module.exports = {
  debug, warn, error, fetchJSON
};
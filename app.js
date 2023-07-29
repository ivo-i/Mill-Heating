'use strict';

const Homey = require('homey');
const Mill = require('./lib/mill');

class MillApp extends Homey.App {
  async onInit() {
    this.millApi = new Mill(this);
    this.user = null;
    this.isAuthenticated = false;
    this.isAuthenticating = false;

    this.log(`${this.homey.manifest.id} is running..`);

    process.env.TZ = 'Europe/Oslo';
    await this.connectToMill().then(() => {
      this.dDebug('Connected to Mill');
    }).catch((err) => {
      this.dError('Error caught while connecting to Mill', err);
      return err;
    });

    if (!this.homey.settings.get('interval')) {
      this.homey.settings.set('interval', 300);
    }
    if (!this.homey.settings.get('senseInterval')) {
      this.homey.settings.set('senseInterval', 900);
    }
  }

  async connectToMill() {
    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');

    if (!username || !password) {
      this.dError('No username or password set');
      throw new Error('No username or password set');
    }

    return this.authenticate(username, password);
  }

  async authenticate(username, password) {
    if (username && password && !this.isAuthenticating) {
      try {
        this.isAuthenticating = true;
        this.user = await this.millApi.login(username, password) || null;
        this.isAuthenticated = true;
        this.log('Mill authenticated');
        return true;
      } catch (e) {
        this.log('Error authenticating', e);
        this.isAuthenticated = false;
        this.user = null;
        return false;
      } finally {
        this.isAuthenticating = false;
      }
    }
    return false;
  }

  clear() {
    this.user = null;
  }

  isConnected() {
    return this.isAuthenticated;
  }

  getUser() {
    return this.user;
  }

  getMillApi() {
    return this.millApi;
  }

  async dLog(severity, message, data) {
    if (!this.homey) {
      this.log(`${severity}: ${message}`, data || '');
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

  async dDebug(message, data) {
    await this.dLog('DEBUG', message, data);
  }

  async dWarn(message, data) {
    await this.dLog('WARN', message, data);
  }

  async dError(message, data) {
    await this.dLog('ERROR', message, data);
  }
}

module.exports = MillApp;

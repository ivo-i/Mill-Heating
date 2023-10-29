'use strict';

const Homey = require('homey');
const millCloud = require('./lib/millCloud');

class MillApp extends Homey.App {
  async onInit() {
    this.millCloud = new millCloud(this);
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
      await this.homey.settings.set('interval', 300);
    }
    if (!this.homey.settings.get('senseInterval')) {
      await this.homey.settings.set('senseInterval', 900);
    }

    if (this.homey.settings.get('interval') < 60 || this.homey.settings.get('interval') > 3600) {
      this.dWarn('Interval is not between 60 and 3600 seconds, resetting to 300 seconds');
      await this.homey.settings.set('interval', 300);
    }
    if (this.homey.settings.get('senseInterval') < 60 || this.homey.settings.get('senseInterval') > 3600) {
      this.dWarn('Sense interval is not between 60 and 3600 seconds, resetting to 900 seconds');
      await this.homey.settings.set('senseInterval', 900);
    }

    await this.homey.settings.on('set', async (key) => {
      if (key === 'username' || key === 'password') {
        await this.homey.settings.unset('debugLog');
        await this.homey.api.realtime('debugLog', null);
        return await this.onInit();
      }
    });
  }

  async connectToMill() {
    const username = await this.homey.settings.get('username');
    const password = await this.homey.settings.get('password');

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
        this.user = await this.millCloud.login(username, password) || null;
        this.isAuthenticated = true;
        this.dDebug('Mill authenticated');
        return true;
      } catch (e) {
        this.dError('Error authenticating', e);
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
    return this.millCloud;
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

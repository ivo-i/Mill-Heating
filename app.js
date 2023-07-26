'use strict';

const Homey = require('homey');
const Mill = require('./lib/mill');
const { debug } = require('./lib/util');

class MillApp extends Homey.App {
  async onInit() {
    this.millApi = new Mill();
    this.user = null;
    this.isAuthenticated = false;
    this.isAuthenticating = false;

    this.log(`${this.homey.manifest.id} is running..`);

    process.env.TZ = 'Europe/Oslo';
    await this.connectToMill();
  }

  async connectToMill() {
    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');

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
}

module.exports = MillApp;

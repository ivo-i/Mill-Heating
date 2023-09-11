'use strict';

const Room = require('./models');
const axios = require('axios');

class Mill {
  constructor(app) {
    this.authEndpoint = 'https://api.millnorwaycloud.com';
    this.endpoint = 'https://api.millnorwaycloud.com';
    this.user = null;
    this.auth = {};
    this.nonce = 'AQcDfGrE34DfGdsV';
    this.timeZoneNum = '+02:00';

    this.app = app;

    this.isRefreshing = false;
    this.pendingRequests = [];
  }

  async login(username, password) {
    const body = {
      'login': username,
      'password': password,
    };

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const endpoint = `${this.authEndpoint}/customer/auth/sign-in`;
    try {
      const response = await axios.post(endpoint, body, { headers });
      const data = response.data;
      this.auth = {
        token: data.idToken,
        refreshToken: data.refreshToken,
      };

      this.user = {
        ...data,
        login: username,
        password: password,
      };

      this.app.dDebug(`Successfully logged in as ${this.user.login}`);

      return data;
    } catch (error) {
      if (error.response) {
        this.app.dError(error.response.data);
        this.app.dError(error.response.status);
        this.app.dError(error.response.headers);
      } else if (error.request) {
        this.app.dError(error.request);
      } else {
        this.app.dError('Error', error);
      }
      if (error.response && error.response.data.error.type === 'LogInError') {
        this.app.dError(error.response.data.error.message);
      }
    }
  }

  async processQueue(error, token = null) {
    this.pendingRequests.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });

    this.pendingRequests = [];
  }

  async updateAccessToken() {
    // Ensure that any pending request finishes before proceeding.
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    this.app.dDebug('Refreshing access token');

    try {
      const headers = {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + this.auth.refreshToken,
      };

      const endpoint = `${this.authEndpoint}/customer/auth/refresh`;
      const response = await axios.post(endpoint, {}, { headers });
      const { idToken, refreshToken } = response.data;

      this.auth = {
        token: idToken,
        refreshToken,
      };

      this.isRefreshing = false;
      this.processQueue(null, idToken);
      this.app.dDebug('Access token refreshed');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.app.dError('Refresh token expired', error);
        return await this.app.connectToMill().catch((error) => {
          this.app.dError('Failed to reconnect to Mill', error);
          throw new Error('Failed to reconnect to Mill', error);
        });
      }
      this.isRefreshing = false;
      this.processQueue(error);
      this.app.dError('Failed to refresh access token', error);
      throw error;
    }
  }

  async request(command, body = null, requestMethod = 'get') {
    // Ensure that any pending request finishes before proceeding.
    if (this.isRefreshing) {
      await new Promise((resolve) => {
        this.pendingRequests.push({ resolve });
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.token,
    };

    try {
      const endpoint = `${this.endpoint}/${command}`;
      let response;
      switch (requestMethod.toLowerCase()) {
        case 'delete':
          response = await axios.delete(endpoint, { headers });
          break;
        case 'patch':
          response = await axios.patch(endpoint, body, { headers });
          break;
        case 'post':
          response = await axios.post(endpoint, body, { headers });
          break;
        case 'get':
        default:
          response = await axios.get(endpoint, { headers });
          break;
      }

      if (response.data.rooms?.roomControlSource === 'mobile_api' || response.data?.roomControlSource === 'mobile_api') {
        this.app.dDebug(`[${this.app.homey.manifest.name.en}] Room control source is mobile_api, updating to open_api`);
        
        await this.updateControlSource(response.data.rooms?.id || response.data?.id, 'open_api').then(() => {
          this.app.dDebug(`[${this.app.homey.manifest.name.en}] Control source set to open_api`);
        }).catch((err) => {
          this.app.dError(`[${this.app.homey.manifest.name.en}] Error setting control source to open_api`, err);
        });
      }

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Token expired, refresh and retry request
        await this.updateAccessToken();
        return this.request(command, body, requestMethod);
      } else {
        throw error;
      }
    }
  }

  async updateControlSource(roomId, controlSource) {
    const body = {
      controlSource: controlSource,
    };

    return this.request(`rooms/${roomId}/external-control`, body, 'patch');
  }

  // returns a list of homes
  async listHomes() {
    return this.request(`houses`);
  }

  // returns a list of rooms in a house
  async listRooms(homeId) {
    return this.request(`houses/${homeId}/rooms`);
  }

  // returns a list of devices in a room
  async listDevices(roomId) {
    const room = await this.request(`rooms/${roomId}/devices`);
    if (!Room.validateRoom(room)) {
      throw new Error(`Invalid response from Mill API: ${JSON.stringify(room)}`);
    }

    return new Room(room);
  }

  async listAllDevices(homeId) {
    return this.request(`houses/${homeId}/devices`);
  }

  async listIndependentDevices(homeId) {
    return this.request(`houses/${homeId}/devices/independent?filterDevices=sensorsAndPurifiers`);
  }

  async getDevice(deviceId) {
    return this.request(`devices/${deviceId}/data`);
  }

  async changeRoomTemperature(roomId, tempSettings) {
    const body = {
      roomComfortTemperature: tempSettings.roomComfortTemperature,
      roomSleepTemperature: tempSettings.roomSleepTemperature,
      roomAwayTemperature: tempSettings.roomAwayTemperature
    };
    return this.request(`rooms/${roomId}/temperature`, body, 'post');
  }

  async changeRoomMode(roomId, mode) {
    if (mode === 'weekly_program') {
      const body = {
        disableOverride: true,
      };
      return this.request(`rooms/${roomId}/mode/override`, body, 'delete');
    }

    const now = new Date();
    now.setHours(now.getHours() + 3);
    const epochPlusOneHour = now.getTime();

    const body = {
      overrideModeType: 'continuous',
      overrideEndDate: 9999999999,
      mode: mode
    };
    return this.request(`rooms/${roomId}/mode/override`, body, 'post');
  }

  async changeFanMode(deviceId, mode) {
    const state = mode !== "SOFT_OFF" && mode !== "HARD_OFF";
    const body = {
      deviceType: 'Air Purifiers',
      enabled: state,
      settings: {
        fan_speed_mode: mode
      }
    };
    this.app.dDebug(`changeFanMode body ${body}`);
    return this.request(`devices/${deviceId}/settings`, body, 'patch');
  }

  async checkMigrationStatus(email) {
    const headers = {
      'Accept': 'application/json',
    };

    if (email.includes('@')) {
      var loginType = 'email';
    } else {
      var loginType = 'phoneNumber';
    }

    const endpoint = `${this.endpoint}/cloud-migration/migration-status?loginType=${loginType}&login=${email}`;
    const json = await axios.get(endpoint, { headers });

    if (json.error) {
      throw new Error(json.data);
    } else {
      this.app.dError(json.data);
      this.app.dError(endpoint);
      if (json.data.needSynchronize === true) {
        return false;
      } else {
        return true;
      }
    }
  }

  async migrateCustomer(username, password) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (username.includes('@')) {
      var loginType = 'email';
    } else {
      var loginType = 'phoneNumber';
    }

    const body = {
      "login": {
        "type": loginType,
        "value": username
      },
      "password": password,
    };

    const endpoint = `${this.endpoint}/cloud-migration/migrate-customer`;
    const json = await axios.post(endpoint, body, { headers });

    if (json.error) {
      throw new Error(json.data);
    } else {
      if (json.data.status === 'ok') {
        true;
      } else {
        false;
      }
    }
  }
}

module.exports = Mill;

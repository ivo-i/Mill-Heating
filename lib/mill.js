'use strict';

const Room = require('./models');
const axios = require('axios');

class Mill {
  constructor() {
    this.authEndpoint = 'https://api.millnorwaycloud.com';
    this.endpoint = 'https://api.millnorwaycloud.com';
    this.user = null;
    this.auth = {};
    this.nonce = 'AQcDfGrE34DfGdsV';
    this.timeZoneNum = '+02:00';

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

      return data;
    } catch (error) {
      if (error.response) {
        console.log(error.response.data);
        console.log(error.response.status);
        console.log(error.response.headers);
      } else if (error.request) {
        console.log(error.request);
      } else {
        console.log('Error', error.message);
      }
      if (error.response && error.response.data.error.type === 'LogInError') {
        console.log(error.response.data.error.message);
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
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.pendingRequests.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    console.log('Refreshing access token');

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
      console.log('Access token refreshed');
    } catch (error) {
      console.error(error);
      this.isRefreshing = false;
      this.processQueue(error);
      console.log('Failed to refresh access token');
      throw error;
    }
  }

  async request(command, body = null) {
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
      if (body !== null) {
        if (body.disableOverride === true) {
          response = await axios.delete(endpoint, { headers });
        } else {
          response = await axios.post(endpoint, body, { headers });
        }
      } else {
        response = await axios.get(endpoint, { headers });
      }

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Token expired, refresh and retry request
        await this.updateAccessToken();
        return this.request(command, body);
      } else {
        throw error;
      }
    }
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
    return this.request(`rooms/${roomId}/temperature`, body);
  }

  async changeRoomMode(roomId, mode) {
    if (mode === 'weekly_program') {
      const body = {
        disableOverride: true,
      };
      return this.request(`rooms/${roomId}/mode/override`, body);
    }

    const now = new Date();
    now.setHours(now.getHours() + 3);
    const epochPlusOneHour = now.getTime();

    const body = {
      overrideModeType: 'continuous',
      overrideEndDate: 9999999999,
      mode: mode
    };
    return this.request(`rooms/${roomId}/mode/override`, body);
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
      console.log(json.data);
      console.log(endpoint);
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

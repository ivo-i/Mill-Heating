'use strict';

const Room = require('./models');
const { fetchJSON } = require('./util');

const TOKEN_SAFE_ZONE = 5 * 60 * 1000;

class Mill {
  constructor() {
    this.authEndpoint = 'https://api.millnorwaycloud.com';
    this.endpoint = 'https://api.millnorwaycloud.com';
    this.user = null;
    this.auth = null;
    this.nonce = 'AQcDfGrE34DfGdsV';
    this.timeZoneNum = '+02:00';
  }

  async login(username, password) {
    const body = JSON.stringify({
      login: username,
      password
    });

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const endpoint = `${this.authEndpoint}/customer/auth/sign-in`;
    const json = await fetchJSON(endpoint, { method: 'POST', body, headers });

    if (json.error) {
      throw new Error(json.error);
    } else {
      this.user = json;
      this.auth = {
        token: json.idToken,
        refreshToken: json.refreshToken,
      };
      return json;
    }
  }

  async updateAccessToken() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.token,
    };

    const endpoint = `${this.authEndpoint}/customer/auth/refresh`;
    const json = await fetchJSON(endpoint, { method: 'POST', headers });

    if (json.error) {
      throw new Error(json.error);
    } else {
      this.auth = {
        token: json.idToken,
        refreshToken: json.refreshToken,
      };
    }
  }

  async validateAccessTokens() {
    const now = new Date();
    const tokenExpiration = this.auth.tokenExpire.getTime() - now.getTime();

    if (tokenExpiration < TOKEN_SAFE_ZONE) {
      await this.updateAccessToken();
    }
  }

  async request(command, body) {
    const bodyStr = JSON.stringify(body || {});

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.token,
    };

    //await this.validateAccessTokens();

    const endpoint = `${this.endpoint}/${command}`;
    const json = await fetchJSON(endpoint, { method: 'POST', body: bodyStr, headers });
    if (json.error) {
      throw new Error(json.error);
    } else {
      return json;
    }
  }

  // returns a list of homes
  async listHomes() {
    return this.request(`/houses`);
  }

  // returns a list of rooms in a house
  async listRooms(homeId) {
    return this.request(`/houses/${homeId}/rooms`, { timeZoneNum: this.timeZoneNum });
  }

  // returns a list of devices in a room
  async listDevices(roomId) {
    const room = await this.request(`/rooms/${roomId}/devices`, { timeZoneNum: this.timeZoneNum });
    if (!Room.validateRoom(room)) {
      throw new Error(`Invalid response from Mill API: ${JSON.stringify(room)}`);
    }

    return new Room(room);
  }

  async changeRoomTemperature(roomId, tempSettings) {
    const body = {
      roomComfortTemperature: tempSettings.comfortTemp,
      roomSleepTemperature: tempSettings.sleepTemp,
      roomAwayTemperature: tempSettings.awayTemp
    };
    return this.request(`/rooms/${roomId}/temperature`, body);
  }

  async changeRoomMode(roomId, mode) {
    const now = new Date();
    const epoch = now.getTime() - (now.getTimezoneOffset() * 60 * 1000);
    const epochPlusOneHour = epoch + (60 * 60 * 1000);

    const body = {
      overrideModeType: 'not_continuous',
      overrideEndDate: epochPlusOneHour,
      mode: mode
    };
    return this.request(`/rooms/${roomId}/mode/override`, body);
  }
}

module.exports = Mill;

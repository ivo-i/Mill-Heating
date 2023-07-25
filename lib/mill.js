'use strict';

const Room = require('./models');
const { fetchJSON } = require('./util');
const axios = require('axios');

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
    const body = {
      'login': username,
      'password': password,
    };

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    const endpoint = `${this.authEndpoint}/customer/auth/sign-in`;
    //Send body som RAW JSON, med axios
    const json = await axios.post(endpoint, body, { headers });

    if (json.error) {
      throw new Error(json.error);
    } else {
      this.user = json;
      this.auth = {
        token: json.data.idToken,
        refreshToken: json.data.refreshToken,
        tokenExpire: new Date().getTime() + 20 * 60 * 1000,
      };
      console.log(this.auth);
      return json;
    }
  }

  async updateAccessToken() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.refreshToken,
    };

    const endpoint = `${this.authEndpoint}/customer/auth/refresh`;
    const json = await axios.post(endpoint, { headers });

    if (json.error) {
      throw new Error(json.error);
    } else {
      //Token expires after 20 minutes
      let nowPlus20 = new Date();
      nowPlus20.setMinutes(nowPlus20.getMinutes() + 20);
      this.auth = {
        token: json.idToken,
        refreshToken: json.refreshToken,
        tokenExpire: new Date(nowPlus20),
      };
    }
  }

  async validateAccessTokens() {
    console.log('Validating access tokens');
    const now = new Date();
    const tokenExpire = new Date(this.auth.tokenExpire);
    const tokenExpiration = tokenExpire.getTime() - now.getTime();

    if (tokenExpiration < TOKEN_SAFE_ZONE) {
      console.log('Token expires soon, refreshing');
      await this.updateAccessToken();
    }
    return true;
  }

  async request(command, body) {
    console.log('Requesting', command, body);
    body = JSON.stringify(body || null);

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.token,
    };

    await this.validateAccessTokens();
    console.log('Access tokens validated');

    const endpoint = `${this.endpoint}/${command}`;
    console.log('Endpoint', endpoint);
    let json;
    if (body !== null) {
      console.log('Sending body', body);
      json = await axios.post(endpoint, body, { headers });
    } else {
      console.log('No body');
      json = await axios.post(endpoint, { headers });
    }
    console.log('Response', json);
    if (json.error) {
      console.log(json);
      throw new Error(json.error);
    } else {
      return json;
    }
  }

  // returns a list of homes
  async listHomes() {
    return this.request(`houses`);
  }

  // returns a list of rooms in a house
  async listRooms(homeId) {
    return this.request(`houses/${homeId}/rooms`, { timeZoneNum: this.timeZoneNum });
  }

  // returns a list of devices in a room
  async listDevices(roomId) {
    const room = await this.request(`rooms/${roomId}/devices`, { timeZoneNum: this.timeZoneNum });
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
    return this.request(`rooms/${roomId}/temperature`, body);
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
    return this.request(`rooms/${roomId}/mode/override`, body);
  }
}

module.exports = Mill;

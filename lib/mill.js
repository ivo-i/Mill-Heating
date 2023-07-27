'use strict';

const Room = require('./models');
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

    /*await this.checkMigrationStatus(username).then(async (result) => {
      if (!result) {
        console.log('User has not migrated to new API');
        console.log(result);
        await this.migrateCustomer(username, password).then((result) => {
          if (result) {
            console.log('Migration successful');
            console.log(result);
            console.log('Logging in user');
          } else {
            console.log('Migration failed');
            return false;
          }
        });
      } else {
        console.log('User has already migrated to new API');
      }
    });*/

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
      this.user = {
        ...this.user,
        login: username,
        password: password,
      };
      this.auth = {
        token: json.data.idToken,
        refreshToken: json.data.refreshToken,
        tokenExpire: new Date().getTime() + 20 * 60 * 1000,
      };
      return json;
    }
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

  async updateAccessToken() {
    console.log('Updating access token');
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.refreshToken,
    };

    const endpoint = `${this.authEndpoint}/customer/auth/refresh`;
    const json = await axios.post(endpoint, { headers });

    console.log(json.status);
    if (json.status === 401) {
      //Refresh token expired, logg inn på nytt
      await console.login(this.user.login, this.user.password);
      console.log(this.user.login, this.user.password);
      return this.updateAccessToken();
    }
    if (json.error) {
      throw new Error(json.error, json.status, json.error.data);
    } else {
      //Token expires after 20 minutes
      let nowPlus20 = new Date();
      nowPlus20.setMinutes(nowPlus20.getMinutes() + 10);
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
    //console.log(`Token expires in ${tokenExpiration / 1000} seconds`);
    //console.log(tokenExpire.toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo' }));
    //console.log(tokenExpiration < TOKEN_SAFE_ZONE);

    if (tokenExpiration < TOKEN_SAFE_ZONE) {
      console.log('Token expires soon, refreshing');
      await this.updateAccessToken();
    }
    return true;
  }

  async request(command, body) {
    body = body || null;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ' + this.auth.token,
    };

    await this.validateAccessTokens();
    const endpoint = `${this.endpoint}/${command}`;
    let json;

    if (body !== null) {
      if (body.disableOverride === true) {
        json = await axios.delete(endpoint, { headers });
      } else {
        json = await axios.post(endpoint, body, { headers });
      }
    } else {
      json = await axios.get(endpoint, { headers });
    }

    if (json.status === 401) {
      //Token expired, logg inn på nytt, og kjør request på nytt
      await console.login(this.user.login, this.user.password);
      return this.request(command, body);
    }

    if (json.error) {
      throw new Error(json.error);
    } else {
      return json.data;
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
}

module.exports = Mill;

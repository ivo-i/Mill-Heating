'use strict';

const { Driver } = require('homey');

class MillDriver extends Driver {
  async onInit() {
  }

  async onPairListDevices() {
    if (!this.homey.app.isConnected()) {
      this.homey.app.dDebug('Unable to pair, not authenticated');
      new Error(this.homey.__('pair.messages.notAuthorized'));
      await this.homey.app.connectToMill().then(() => {
        this.homey.app.dDebug('Connected to Mill');
        return this.onPairListDevices();
      }).catch((error) => {
        this.homey.app.dError(error);
        this.homey.app.dDebug('Unable to connect to Mill');
        const errorString = `Unable to connect to Mill: ${error}`;
        return new Error(errorString);
      });
    } else {
      this.homey.app.dDebug('Pairing');
      const millApi = this.homey.app.getMillApi();
      const homes = await millApi.listHomes();
      this.homey.app.dDebug(`Found following homes: ${homes.ownHouses.map(home => `${home.name} (${home.id})`).join(', ')}`);

      const rooms = await Promise.all(homes.ownHouses.map(async (home) => {
        const rooms = await millApi.listRooms(home.id);
        this.homey.app.dDebug(`Found following rooms in ${home.name}: ${rooms.rooms.map(room => `${room.name} (${room.id})`).join(', ')}`);

        return rooms.rooms.map(room => (
          {
            name: room.name,
            data: {
              id: room.id,
              homeId: homes.ownHouses[0].id,
              homeName: homes.ownHouses[0].name,
              name: room.name,
              temp: room.averageTemperature,
              alive: room.isRoomOnline === true
            }
          }
        ));
      }));
      return rooms.reduce((acc, val) => acc.concat(val), []);
    }
  }
}

module.exports = MillDriver;

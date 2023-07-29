'use strict';

const { Driver } = require('homey');

class MillSenseDriver extends Driver {
  async onInit() {
  }

  async onPairListDevices() {
    if (!this.homey.app.isConnected()) {
      this.homey.app.dDebug('Unable to pair, not authenticated');
      this.homey.app.dError(new Error(this.homey.__('pair.messages.notAuthorized')));
      await this.homey.app.connectToMill();
      return this.onPairListDevices();
    } else {
      this.homey.app.dDebug('Pairing');
      const millApi = this.homey.app.getMillApi();
      const homes = await millApi.listHomes();
      this.homey.app.dDebug(`Found following homes: ${homes.ownHouses.map(home => `${home.name} (${home.id})`).join(', ')}`);
      this.homey.app.dDebug(`Found following shared homes: ${homes.sharedHouses.map(home => `${home.house.name} (${home.house.id})`).join(', ')}`);

      let allHomes = [];
      // Se gjennom alle ownHouses og sharedHouses og legg til i allHomes
      for (const home of homes.ownHouses) {
        allHomes.push(home);
      }
      for (const sharedHome of homes.sharedHouses) {
        allHomes.push(sharedHome.house);
      }

      const devices = await Promise.all(allHomes.map(async (home) => {
        const devices = await millApi.listIndependentDevices(home.id);

        // Filter devices that meet your condition
        const filteredDevices = devices.items.filter(device =>
          device.deviceType &&
          device.deviceType.childType &&
          device.deviceType.childType.name.includes('GL-Sense')
        );
        
        this.homey.app.dDebug(`Found following devices in all homes: ${filteredDevices.map(device => `${device.customName} (${device.deviceId})`).join(', ')}`);

        return filteredDevices.map(device => (
          {
            name: device.customName,
            data: {
              id: device.deviceId,
              homeId: home.id,
              homeName: home.name,
              name: device.customName,
            }
          }
        ));
      }));

      return devices.reduce((acc, val) => acc.concat(val), []);
    }
  }
}

module.exports = MillSenseDriver;

module.exports = {
  async authenticate({ homey, query }) {
    try {
      const result = await homey.app.authenticate(query.username, query.password);
      return result;
    } catch (error) {
      return error;
    }
  },
  async clearSettings({ homey }) {
    homey.app.clear();
    return {};
  },
  async clearLog({ homey }) {
    homey.ManagerSettings.set('debugLog', []);
    return {};
  },
};

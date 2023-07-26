class Room {
  constructor(room) {
    Object.assign(this, room);
  }

  static validateRoom(room) {
    return room.mode && room.id;
  }

  /*get mode() {
    return this.mode > 0 ? this.lastMetrics : this.programMode;
  }

  set mode(mode) {
    if (mode >= 0 && mode <= 5) {
      this.currentMode = mode;
    }
  }*/

  get modeName() {
    switch (this.mode) {
      case 'weekly_program':
        return 'Weekly program';
      case 'comfort':
        return 'Comfort';
      case 'sleep':
        return 'Sleep';
      case 'away':
        return 'Away';
      case 'vacation':
        return 'Holiday';
      case 'Off':
        return 'Off';
      default:
        return 'Unknown';
    }
  }

  set modeName(name) {
    switch (name) {
      case 'Weekly program':
        this.currentMode = 0;
        break;
      case 'Comfort':
        this.currentMode = 1;
        break;
      case 'Sleep':
        this.currentMode = 2;
        break;
      case 'Away':
        this.currentMode = 3;
        break;
      case 'Holiday':
        this.currentMode = 4;
        break;
      case 'Off':
        this.currentMode = 5;
        break;
      default:
        break;
    }
  }

  get targetTemp() {
    switch (this.mode) {
      case 1:
        return this.comfortTemp;
      case 2:
        return this.sleepTemp;
      case 3:
        return this.awayTemp;
      case 4:
        return this.holidayTemp;
      case 5:
        return 0;
      default:
        return 0;
    }
  }

  set targetTemp(temp) {
    switch (this.mode) {
      case 1:
        this.comfortTemp = temp;
        break;
      case 2:
        this.sleepTemp = temp;
        break;
      case 3:
        this.awayTemp = temp;
        break;
      case 4:
        this.holidayTemp = temp;
        break;
      default:
        break;
    }
  }

  get isHeating() {
    return this.heatStatus === 1;
  }

  modesMatch(room) {
    return this.currentMode === room.mode && this.programMode === room.roomProgramName;
  }
}


module.exports = Room;

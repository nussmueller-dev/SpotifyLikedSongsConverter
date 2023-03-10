const dataFilePath = "./storage/data.json";
const fs = require("fs");

export class StorageHandler {
  data = new StorageData();

  constructor() {
    this.loadData();
  }

  loadData() {
    if (!fs.existsSync(dataFilePath)) {
      this.saveData();
    }

    let fileContent = fs.readFileSync(dataFilePath);
    this.data = JSON.parse(fileContent);
  }

  saveData() {
    let json = JSON.stringify(this.data);
    fs.writeFileSync(dataFilePath, json, { flag: "w" });
  }
}

export class StorageData {
  token: string = "";
  refreshToken: string = "";
}

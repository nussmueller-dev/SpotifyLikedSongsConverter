const fs = require('fs');
const dataFilePath = 'storage/data.json';

class StorageHandler {
    static data = {
        token: '',
        refreshToken: ''
    };

    static loadData() {
        if (!fs.existsSync(dataFilePath)) {
            this.save();
        }

        let fileContent = fs.readFileSync(dataFilePath);
        this.data = JSON.parse(fileContent);
    }

    static saveData() {
        let json = JSON.stringify(this.data);
        fs.writeFileSync(dataFilePath, json, { flag: 'w' });
    }
}

module.exports = StorageHandler;
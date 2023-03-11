import moment from "moment";
import schedule from "node-schedule";
import config from "./config/config.json";
import { SpotifyHandler } from "./spotifyHandler";

const spotifyHandler = new SpotifyHandler();

async function main() {
  await spotifyHandler.syncLikedSongsToPlaylist(config.playListName);

  schedule.scheduleJob("*/15 * * * *", async function () {
    console.log(`ScheduleJob at ${moment().format("DD.MM.YYYY HH:mm:ss")}`);
    console.log(
      "------------------------------------------------------------------"
    );
    await spotifyHandler.syncLikedSongsToPlaylist(config.playListName);
    console.log(
      "------------------------------------------------------------------"
    );
  });
}

main();

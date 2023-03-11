import schedule from "node-schedule";
import config from "./config/config.json";
import { SpotifyHandler } from "./spotifyHandler";

const spotifyHandler = new SpotifyHandler();

async function main() {
  await spotifyHandler.syncLikedSongsToPlaylist(config.playListName);

  schedule.scheduleJob("*/15 * * * *", async function () {
    await spotifyHandler.syncLikedSongsToPlaylist(config.playListName);
  });
}

main();

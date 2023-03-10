import { StorageHandler } from "./storageHandler";

const Config = require("./storage/config.json");
const Client = require("spotify-web-api-node");
const express = require("express");
const app = express();

const scopes = [
  "user-library-read",
  "playlist-modify-private",
  "playlist-modify-public",
  "playlist-read-private",
];

const spotifyApi = new Client({
  clientId: Config.clientId,
  clientSecret: Config.clientSecret,
  redirectUri: Config.redirectUrl,
});

export class SpotifyHandler {
  storageHandler = new StorageHandler();

  constructor() {}
}

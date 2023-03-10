import express, { Express, Request, Response } from "express";
import { Server } from "http";
import Client from "spotify-web-api-node";
import config from "./storage/config.json";
import { StorageHandler } from "./storageHandler";

const scopes = [
  "user-library-read",
  "playlist-modify-private",
  "playlist-modify-public",
  "playlist-read-private",
];

const app: Express = express();
const spotifyApi = new Client({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  redirectUri: config.redirectUrl,
});

export class SpotifyHandler {
  storageHandler = new StorageHandler();
  server: Server | undefined;

  constructor() {
    this.setupCallbackApi();
  }

  async createPlaylistFromLikedSongs(playlistName: string) {
    try {
      if (!spotifyApi.getAccessToken()) {
        try {
          spotifyApi.setAccessToken(this.storageHandler.data.token);
          spotifyApi.setRefreshToken(this.storageHandler.data.refreshToken);
          await spotifyApi.getMe();
        } catch {
          await this.authorizeApp();
        }
      }

      const user = await spotifyApi.getMe();
      const playlists = await spotifyApi.getUserPlaylists(user.body.id);
      let playlist = playlists.body.items.find((p) => p.name === playlistName);

      if (!playlist) {
        console.log(`Playlist '${playlistName}' not found, creating it...`);
        let playlistResponse = await spotifyApi.createPlaylist(playlistName);
        playlist = playlistResponse.body;
      }

      console.log(`Using playlist '${playlist.name}' (${playlist.id})`);

      const pageSize = 50;
      let offset = 0;
      let totalSongsCount;
      let allLikedSongs: any = [];
      do {
        let savedTracks = await spotifyApi.getMySavedTracks({
          limit: pageSize,
          offset: offset,
        });
        totalSongsCount = savedTracks.body.total;

        let songs = savedTracks.body.items.map((song) => {
          return { id: song.track.id, uri: song.track.uri };
        });
        allLikedSongs = allLikedSongs.concat(songs);
        offset += pageSize;
      } while (allLikedSongs.length < totalSongsCount);

      console.log(`Retrieved ${allLikedSongs.length} liked songs`);

      offset = 0;
      let playlistSongs: any = [];
      do {
        let savedTracks = await spotifyApi.getPlaylistTracks(playlist.id, {
          limit: pageSize,
          offset: offset,
        });
        totalSongsCount = savedTracks.body.total;

        let songs = savedTracks.body.items.map((song) => {
          return { id: song.track?.id, uri: song.track?.uri };
        });
        playlistSongs = playlistSongs.concat(songs);
        offset += pageSize;
      } while (playlistSongs.length < totalSongsCount);

      console.log(`Retrieved ${playlistSongs.length} playlist songs`);

      const songsToRemove = playlistSongs.filter(
        (song: any) => !allLikedSongs.some((x: any) => x.id === song.id)
      );
      if (songsToRemove.length > 0) {
        console.log(`Removing ${songsToRemove.length} songs from playlist`);

        const chunkSize = 100;
        for (let i = 0; i < songsToRemove.length; i += chunkSize) {
          const tracks = songsToRemove.slice(i, i + chunkSize);
          await spotifyApi.removeTracksFromPlaylist(playlist.id, tracks);
        }
      } else {
        console.log("No songs to remove");
      }

      const tracksToAdd = allLikedSongs.filter(
        (song: any) => !playlistSongs.some((x: any) => x.id === song.id)
      );
      if (tracksToAdd.length !== 0) {
        console.log(`Adding ${tracksToAdd.length} new songs to playlist`);

        const chunkSize = 100;
        for (let i = 0; i < tracksToAdd.length; i += chunkSize) {
          const tracks = tracksToAdd
            .slice(i, i + chunkSize)
            .map((x: any) => x.uri);
          await spotifyApi.addTracksToPlaylist(playlist.id, tracks);
        }
      } else {
        console.log("All liked songs are already in the playlist");
      }

      console.log("Playlist updated successfully!");
    } catch (err) {
      console.error("An error occurred:", err);
    }
  }

  async authorizeApp() {
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, "some-state");

    this.server = app.listen(8888, () => {
      console.log("Please authorize this app on the following page:");
      console.log(authorizeURL);
    });

    await new Promise((resolve) => this.server!.on("close", resolve));
  }

  setupCallbackApi() {
    app.get("/callback", async (req: Request, res: Response) => {
      const error = req.query.error;
      const code = req.query.code;

      if (error) {
        console.error("Authorization failed:", error);
        res.send("Authorization failed. Please try again.");
        return;
      }

      if (!code) {
        console.error("Authorization failed: no code provided");
        res.send("Authorization failed. Please try again.");
        return;
      }

      try {
        const data = await spotifyApi.authorizationCodeGrant(code as string);
        const access_token = data.body["access_token"];
        const refresh_token = data.body["refresh_token"];
        console.log("Authorization successful!");

        this.storageHandler.data.token = access_token;
        this.storageHandler.data.refreshToken = refresh_token;
        this.storageHandler.saveData();

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);
        await spotifyApi.getMe();

        res.send(
          "Authorization successful! Please close this window and return to the console."
        );

        this.server?.close();
      } catch (err) {
        console.error("Authorization failed:", err);
        res.send("Authorization failed. Please try again.");
      }
    });
  }
}

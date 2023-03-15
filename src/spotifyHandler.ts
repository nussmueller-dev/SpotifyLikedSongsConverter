import express, { Express, Request, Response } from "express";
import { Server } from "http";
import Client from "spotify-web-api-node";
import config from "./config/config.json";
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

  async syncLikedSongsToPlaylist(playlistName: string) {
    try {
      await this.checkAcces();
      const playlist = await this.getPlaylist(playlistName);
      const likedSongs = await this.getAllTracksFromPlaylist();
      const playlistSongs = await this.getAllTracksFromPlaylist(playlist.id);

      await this.addLikedSongsToPlaylist(
        playlist.id,
        likedSongs,
        playlistSongs
      );
      await this.removeUnlikedTracksFromPlaylist(
        playlist.id,
        likedSongs,
        playlistSongs
      );

      console.log("Playlist updated successfully!");
    } catch (err) {
      console.error("An error occurred:", err);
    }
  }

  private async checkAcces() {
    if (!spotifyApi.getAccessToken()) {
      spotifyApi.setAccessToken(this.storageHandler.data.token);
      spotifyApi.setRefreshToken(this.storageHandler.data.refreshToken);
    }

    try {
      await spotifyApi.getMe();
    } catch {
      await this.authorizeApp();
    }
  }

  private async getPlaylist(playlistName: string) {
    const user = await spotifyApi.getMe();
    const playlists = await spotifyApi.getUserPlaylists(user.body.id);
    let playlist = playlists.body.items.find((p) => p.name === playlistName);

    if (!playlist) {
      console.log(`Playlist '${playlistName}' not found, creating it...`);
      let playlistResponse = await spotifyApi.createPlaylist(playlistName);
      playlist = playlistResponse.body;
    }

    console.log(`Using playlist '${playlist.name}' (${playlist.id})`);

    return playlist;
  }

  private async getAllTracksFromPlaylist(playlistId?: string) {
    const pageSize = 50;
    let offset = 0;
    let totalSongsCount;
    let allSongs: ShortTrackModel[] = [];

    do {
      let savedTracks = playlistId
        ? await spotifyApi.getPlaylistTracks(playlistId, {
            limit: pageSize,
            offset: offset,
          })
        : await spotifyApi.getMySavedTracks({
            limit: pageSize,
            offset: offset,
          });

      totalSongsCount = savedTracks.body.total;

      let songs = savedTracks.body.items.map(
        (song: any) => new ShortTrackModel(song.track.id, song.track.uri)
      );
      allSongs = allSongs.concat(songs);

      offset += pageSize;
    } while (allSongs.length < totalSongsCount);

    console.log(
      `Retrieved ${allSongs.length} ${
        playlistId ? "playlist songs" : "liked songs"
      }`
    );

    return allSongs;
  }

  private async removeUnlikedTracksFromPlaylist(
    playListId: string,
    likedSongs: ShortTrackModel[],
    playlistSongs: ShortTrackModel[]
  ) {
    const songsToRemove = playlistSongs.filter(
      (song: ShortTrackModel) =>
        !likedSongs.some((x: ShortTrackModel) => x.id === song.id)
    );

    if (songsToRemove.length > 0) {
      console.log(`Removing ${songsToRemove.length} songs from playlist`);

      const chunkSize = 100;
      for (let i = 0; i < songsToRemove.length; i += chunkSize) {
        const tracks = songsToRemove.slice(i, i + chunkSize);
        await spotifyApi.removeTracksFromPlaylist(playListId, tracks);
      }
    } else {
      console.log("No songs to remove");
    }
  }

  private async addLikedSongsToPlaylist(
    playListId: string,
    likedSongs: ShortTrackModel[],
    playlistSongs: ShortTrackModel[]
  ) {
    const tracksToAdd = likedSongs.filter(
      (song: ShortTrackModel) =>
        !playlistSongs.some((x: any) => x.id === song.id)
    );
    if (tracksToAdd.length !== 0) {
      console.log(`Adding ${tracksToAdd.length} new songs to playlist`);

      const chunkSize = 100;
      for (let i = 0; i < tracksToAdd.length; i += chunkSize) {
        const tracks = tracksToAdd
          .slice(i, i + chunkSize)
          .map((x: ShortTrackModel) => x.uri);
        await spotifyApi.addTracksToPlaylist(playListId, tracks);
      }
    } else {
      console.log("All liked songs are already in the playlist");
    }
  }

  private async authorizeApp() {
    if(spotifyApi.getAccessToken()){
      let refreshTokenResponse = await spotifyApi.refreshAccessToken().catch(async () => {
        console.log('Refresh-Token not working');
        await this.authorizeAppByUrl();
      });

      if(refreshTokenResponse){
        console.log('Refreshed Acces-Token');
        
        let accesToken = refreshTokenResponse.body['access_token'];
        spotifyApi.setAccessToken(accesToken);
        this.storageHandler.data.token = accesToken;
        this.storageHandler.saveData();
      }
    }else{
      await this.authorizeAppByUrl();
    }
  }

    private async authorizeAppByUrl() {
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes, "some-state");

    this.server = app.listen(8888, () => {
      console.log("Please authorize this app on the following page:");
      console.log(authorizeURL);
    });

    await new Promise((resolve) => this.server!.on("close", resolve));
  }

  private setupCallbackApi() {
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

export class ShortTrackModel {
  constructor(public id: string, public uri: string) {}
}

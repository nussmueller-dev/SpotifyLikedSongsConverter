const Client = require('spotify-web-api-node');
const express = require('express');
const app = express();

const client_id = '31447e0990434b3cb640203f4416b621';
const client_secret = 'eb2787e3f52944e9899ba2d430702a06';
const redirect_uri = 'http://localhost:8888/callback';
const scopes = ['user-library-read', 'playlist-modify-private', 'playlist-modify-public', 'playlist-read-private'];
server = undefined;

const spotifyApi = new Client({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uri
});

app.get('/callback', async (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    if (error) {
        console.error('Authorization failed:', error);
        res.send('Authorization failed. Please try again.');
        return;
    }
    if (!code) {
        console.error('Authorization failed: no code provided');
        res.send('Authorization failed. Please try again.');
        return;
    }
    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const access_token = data.body['access_token'];
        const refresh_token = data.body['refresh_token'];
        console.log('Authorization successful!');
        console.log('Access token:', access_token);
        console.log('Refresh token:', refresh_token);

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        res.send('Authorization successful! Please close this window and return to the console.');

        server.close();
    } catch (err) {
        console.error('Authorization failed:', err);
        res.send('Authorization failed. Please try again.');
    }
});

async function authorizeApp() {
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    server = app.listen(8888, () => {
        console.log('Please authorize this app on the following page:');
        console.log(authorizeURL);
    });
    await new Promise(resolve => server.on('close', resolve));
}

async function createPlaylistFromLikedSongs(playlistName) {
    try {
        if (!spotifyApi.getAccessToken()) {
            await authorizeApp();
        }

        const user = await spotifyApi.getMe();
        const playlists = await spotifyApi.getUserPlaylists(user.body.id);
        let playlist = playlists.body.items.find(p => p.name === playlistName);

        if (!playlist) {
            console.log(`Playlist '${playlistName}' not found, creating it...`);
            let playlistResponse = await spotifyApi.createPlaylist(playlistName);
            playlist = playlistResponse.body;
        }

        console.log(`Using playlist '${playlist.name}' (${playlist.id})`);

        const pageSize = 50;
        let offset = 0;
        let totalSongsCount;
        let allLikedSongs = [];
        do {
            let savedTracks = await spotifyApi.getMySavedTracks({ limit: pageSize, offset: offset });
            totalSongsCount = savedTracks.body.total;

            let songs = savedTracks.body.items.map(song => {
                return { id: song.track.id, uri: song.track.uri }
            });
            allLikedSongs = allLikedSongs.concat(songs);
            offset += pageSize;
        } while (allLikedSongs.length < totalSongsCount);

        console.log(`Retrieved ${allLikedSongs.length} liked songs`);

        offset = 0;
        let playlistSongs = [];
        do {
            let savedTracks = await spotifyApi.getPlaylistTracks(playlist.id, { limit: pageSize, offset: offset });
            totalSongsCount = savedTracks.body.total;

            let songs = savedTracks.body.items.map(song => {
                return { id: song.track.id, uri: song.track.uri }
            });
            playlistSongs = playlistSongs.concat(songs);
            offset += pageSize;
        } while (playlistSongs.length < totalSongsCount);

        console.log(`Retrieved ${playlistSongs.length} playlist songs`);

        const songsToRemove = playlistSongs.filter(song => !allLikedSongs.some(x => x.id === song.id));
        if (songsToRemove.length > 0) {
            console.log(`Removing ${songsToRemove.length} songs from playlist`);

            const chunkSize = 100;
            for (let i = 0; i < songsToRemove.length; i += chunkSize) {
                const tracks = songsToRemove.slice(i, i + chunkSize);
                await spotifyApi.removeTracksFromPlaylist(playlist.id, tracks);
            }
        } else {
            console.log('No songs to remove');
        }

        const tracksToAdd = allLikedSongs.filter(song => !playlistSongs.some(x => x.id === song.id));
        if (tracksToAdd.length !== 0) {
            console.log(`Adding ${tracksToAdd.length} new songs to playlist`);

            const chunkSize = 100;
            for (let i = 0; i < tracksToAdd.length; i += chunkSize) {
                const tracks = tracksToAdd.slice(i, i + chunkSize).map(x => x.uri);
                await spotifyApi.addTracksToPlaylist(playlist.id, tracks);
            }
        } else {
            console.log('All liked songs are already in the playlist');
        }

        console.log('Playlist updated successfully!');
    } catch (err) {
        console.error('An error occurred:', err);
    }
}

createPlaylistFromLikedSongs('My Liked Songs');
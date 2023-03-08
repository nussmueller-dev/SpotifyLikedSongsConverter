const Client = require('spotify-web-api-node');
const express = require('express');
const app = express();

const client_id = '31447e0990434b3cb640203f4416b621';
const client_secret = 'eb2787e3f52944e9899ba2d430702a06';
const redirect_uri = 'http://localhost:8888/callback';
const scopes = ['user-library-read', 'playlist-modify-private'];
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
        console.log('Retrieved user:', user);
        const playlists = await spotifyApi.getUserPlaylists(user.body.id);
        console.log(playlists);
        let playlist = playlists.body.items.find(p => p.name === playlistName);

        if (!playlist) {
            console.log(`Playlist '${playlistName}' not found, creating it...`);
            playlist = await spotifyApi.createPlaylist(playlistName, {
                public: false
            });
        }

        console.log(`Using playlist '${playlist.body.name}' (${playlist.body.id})`);

        const pageSize = 50;
        let offset = 0;
        let totalSongsCount;
        let allLikedSongIds = [];
        do {
            let savedTracks = await spotifyApi.getMySavedTracks({ limit: pageSize, offset: offset });
            totalSongsCount = savedTracks.body.total;

            let songIds = savedTracks.body.items.map(song => song.track.id);
            allLikedSongIds = allLikedSongIds.concat(songIds);
            offset += pageSize;
        } while (allLikedSongIds.length < totalSongsCount);

        console.log(`Retrieved ${allLikedSongIds.length} liked songs`);

        offset = 0;
        let playlistSongIds = [];
        do {
            let savedTracks = await spotifyApi.getMySavedTracks({ limit: pageSize, offset: offset });
            totalSongsCount = savedTracks.body.total;

            let songIds = savedTracks.body.items.map(song => song.track.id);
            playlistSongIds = playlistSongIds.concat(songIds);
            offset += pageSize;
        } while (playlistSongIds.length < totalSongsCount);

        console.log(`Retrieved ${playlistSongIds.length} playlist songs`);

        const songIdsToRemove = playlistSongIds.filter(songId => !allLikedSongIds.includes(songId));
        if (songIdsToRemove.length > 0) {
            console.log(`Removing ${songIdsToRemove.length} songs from playlist`);
            await spotifyApi.removeTracksFromPlaylist(playlistId, songIdsToRemove);
        } else {
            console.log('No songs to remove');
        }

        const tracksToAdd = allLikedSongIds.filter(songId => !playlistSongIds.includes(songId));
        if (tracksToAdd.length !== 0) {
            console.log(`Adding ${tracksToAdd.length} new songs to playlist`);

            const chunkSize = 100;
            for (let i = 0; i < tracksToAdd.length; i += chunkSize) {
                const tracks = tracksToAdd.slice(i, i + chunkSize);
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
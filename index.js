const Client = require('spotify-web-api-node');
const express = require('express');

const client_id = '<your_client_id>';
const client_secret = '<your_client_secret>';
const redirect_uri = 'http://localhost:8888/callback';
const scopes = ['user-library-read', 'playlist-modify-private'];

const spotifyApi = new Client({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUri: redirect_uri
});

const app = express();
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

        server.close();
    } catch (err) {
        console.error('Authorization failed:', err);
        res.send('Authorization failed. Please try again.');
    }
});

async function authorizeApp() {
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    const server = app.listen(8888, () => {
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

        let playlist = null;
        const playlists = await spotifyApi.getUserPlaylists();
        playlists.body.items.forEach(p => {
            if (p.name === playlistName) {
                playlist = p;
            }
        });

        if (!playlist) {
            const user = await spotifyApi.getMe();
            playlist = await spotifyApi.createPlaylist(user.body.id, playlistName, {
                public: false
            });
        }
        console.log(`Using playlist '${playlist.name}' (${playlist.id})`);

        const pageSize = 50;
        let offset = 0;
        let allSongs = [];
        do {
            const { body } = await spotifyApi.getMySavedTracks({ limit: pageSize, offset });
            allSongs = allSongs.concat(body.items);
            offset += pageSize;
        } while (allSongs.length < body.total);

        console.log(`Retrieved ${allSongs.length} liked songs`);

        const allLikedSongIds = allLikedSongs.map(song => song.track.id);
        const playlistSongIds = allPlaylistSongs.map(song => song.track.id);
        const songsToRemove = playlistSongIds.filter(songId => !allLikedSongIds.includes(songId));

        if (songsToRemove.length > 0) {
            console.log(`Removing ${songsToRemove.length} songs from playlist`);
            await spotifyApi.removeTracksFromPlaylist(playlistId, songsToRemove.map(songId => playlistSongIds.first(x => x.track.id === songId)));
        } else {
            console.log('No songs to remove');
        }

        const playlistTracks = await spotifyApi.getPlaylistTracks(playlist.id, { limit: 100 });
        const existingTracks = new Set();
        playlistTracks.body.items.forEach(item => {
            const track = item.track;
            if (track) {
                existingTracks.add(track.id);
            }
        });

        const tracksToAdd = allSongs.filter(song => !existingTracks.has(song.track.id));
        if (tracksToAdd.length === 0) {
            console.log('All liked songs are already in the playlist');
            return;
        }
        console.log(`Adding ${tracksToAdd.length} new songs to playlist`);

        const chunkSize = 100;
        for (let i = 0; i < tracksToAdd.length; i += chunkSize) {
            const tracks = tracksToAdd.slice(i, i + chunkSize).map(song => song.track.uri);
            await spotifyApi.addTracksToPlaylist(playlist.id, tracks);
        }

        console.log('Playlist updated successfully!');
    } catch (err) {
        console.error('An error occurred:', err);
    }
}

createPlaylistFromLikedSongs('My Liked Songs');
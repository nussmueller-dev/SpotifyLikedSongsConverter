const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
    clientId: '31447e0990434b3cb640203f4416b621',
    clientSecret: '5da32882dc5f40c8afe8d628c83c0e92'
});

async function setAccesToken() {
    let credentialResponse = await spotifyApi.clientCredentialsGrant();

    console.log('The access token is ' + credentialResponse.body['access_token']);
    spotifyApi.setAccessToken(credentialResponse.body['access_token']);
}

async function createLikedTracksPlaylist() {
    const playlistName = 'My Liked Tracks';

    console.log('test');
    const playlists = await spotifyApi.getUserPlaylists();
    const playlist = playlists.body.items.find((item) => item.name === playlistName);

    if (playlist) {
        console.log(`Playlist "${playlistName}" already exists!`);
        return playlist.id;
    }

    const createdPlaylist = await spotifyApi.createPlaylist(playlistName, { 'description': 'A playlist of all my liked tracks' });
    console.log(`Playlist "${playlistName}" created!`);
    return createdPlaylist.body.id;
}

async function addLikedTracksToPlaylist(playlistId) {
    const likedTracks = await spotifyApi.getMySavedTracks();

    const trackIds = likedTracks.body.items.map((item) => item.track.id);

    const playlistTracks = await spotifyApi.getPlaylistTracks(playlistId);
    const playlistTrackIds = playlistTracks.body.items.map((item) => item.track.id);

    const newTrackIds = trackIds.filter((id) => !playlistTrackIds.includes(id));

    if (newTrackIds.length === 0) {
        console.log('No new liked tracks to add to the playlist.');
        return;
    }

    const response = await spotifyApi.addTracksToPlaylist(playlistId, newTrackIds);
    console.log(`${response.body.tracks.length} tracks added to the playlist!`);
}

(async () => {
    await setAccesToken();

    console.log(spotifyApi.getAccessToken());

    createLikedTracksPlaylist()
        .then((playlistId) => addLikedTracksToPlaylist(playlistId))
        .catch((error) => {
            console.error('Error occurred: ' + error);
        });
})();

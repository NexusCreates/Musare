History = new Mongo.Collection("history");
Playlists = new Mongo.Collection("playlists");
Rooms = new Mongo.Collection("rooms");

if (Meteor.isClient) {
    Meteor.startup(function() {
        reCAPTCHA.config({
            publickey: '6LcVxg0TAAAAAE18vBiH00UAyaJggsmLm890SjZl'
        });
    });

    var hpSound = undefined;
    var songsArr = [];
    var ytArr = [];
    var _sound = undefined;
    var parts = location.href.split('/');
    var id = parts.pop();
    var type = id.toLowerCase();
    Template.register.events({
        "submit form": function(e){
            e.preventDefault();
            var username = e.target.registerUsername.value;
            var email = e.target.registerEmail.value;
            var password = e.target.registerPassword.value;
            var captchaData = grecaptcha.getResponse();
            Meteor.call("createUserMethod", {username: username, email: email, password: password}, captchaData, function(err, res) {
                grecaptcha.reset();

                if (err) {
                    console.log(err);
                } else {
                    Meteor.loginWithPassword(username, password);
                }
            });
        },

        "click #facebook-login": function(){
            Meteor.loginWithFacebook()
        },

        "click #github-login": function(){
            Meteor.loginWithGithub()
        },

        "click #login": function(){
            $("#register-view").hide();
            $("#login-view").show();
        }
    });

    Template.login.events({
        "submit form": function(e){
            e.preventDefault();
            var username = e.target.loginUsername.value;
            var password = e.target.loginPassword.value;
            Meteor.loginWithPassword(username, password);
            Accounts.onLoginFailure(function(){
                $("input").css("background-color","indianred").addClass("animated shake");
                    $("input").on("click",function(){
                        $("input").css({
                            "background-color": "transparent",
                            "width": "250px"
                     });
                })
            });
        },

        "click #facebook-login": function(){
            Meteor.loginWithFacebook()
        },

        "click #github-login": function(){
            Meteor.loginWithGithub()
        },

        "click #register": function(){
            $("#login-view").hide();
            $("#register-view").show();
        }
    });

    Template.dashboard.events({
        "click .logout": function(e){
            e.preventDefault();
            Meteor.logout();
            if (hpSound !== undefined) {
                hpSound.stop();
            }
        },

        "click .button-tunein": function(){
            SC.stream("/tracks/172055891/", function(sound){
             sound._player._volume = 0.3;
                sound.play();
            });
        },

        "click #play": function(){
            $("#play").hide();
            SC.stream("/tracks/172055891/", function(sound){
                hpSound = sound;
                sound._player._volume = 0.3;
                sound.play();
                $("#stop").on("click", function(){
                    $("#stop").hide();
                    $("#play").show();
                    sound._player.pause();
                })
            });
            $("#stop").show();
        },
        "click #croom_create": function() {
            Meteor.call("createRoom", $("#croom").val(), function (err, res) {
                if (err) {
                    alert("Error " + err.error + ": " + err.reason);
                } else {
                    window.location = "/" + $("#croom").val();
                }
            });
        }
    });

    Template.room.events({
      "click #search-song": function(){
        $("#song-results").empty()
        $.ajax({
          type: "GET",
          url: "https://www.googleapis.com/youtube/v3/search?part=snippet&q=" +  $("#song-input").val() + "&key=AIzaSyAgBdacEWrHCHVPPM4k-AFM7uXg-Q__YXY",
          applicationType: "application/json",
          contentType: "json",
          success: function(data){
            console.log(data);
            for(var i in data.items){
              $("#song-results").append("<p>" + data.items[i].snippet.title + "</p>")
              ytArr.push({title: data.items[i].snippet.title, id: data.items[i].id.videoId});
            }
            console.log(ytArr);
            $("#song-results p").click(function(){
              var title = $(this).text();
              for(var i in ytArr){
                if(ytArr[i].title === title){
                  console.log(ytArr[i].title)
                  var songObj = {
                    id: ytArr[i].id,
                    title: ytArr[i].title,
                    type: "youtube"
                  }
                }
              }
            })
          }
        })
        SC.get('/tracks', { q: $("#song-input").val()}, function(tracks) {
          console.log(tracks);
          for(var i in tracks){
            $("#song-results").append("<p>" + tracks[i].title + "</p>")
            songsArr.push({title: tracks[i].title, id: tracks[i].id, duration: tracks[i].duration / 1000});
          }
          $("#song-results p").click(function(){
            var title = $(this).text();
            for(var i in songsArr){
              if(songsArr[i].title === title){
                var id = songsArr[i].id;
                var duration = songsArr[i].duration;
                var songObj = {
                  title: songsArr[i].title,
                  id: id,
                  duration: duration,
                  type: "soundcloud"
                }
              }
            }
            console.log(id);
          })
        });
      }
    });

    Template.room.helpers({
        type: function() {
          var parts = location.href.split('/');
          var id = parts.pop();
          return id.toUpperCase();
        },
        title: function(){
          return Session.get("title");
        },
        artist: function(){
          return Session.get("artist");
        },
        loaded: function() {
            return Session.get("loaded");
        }
    });

    Template.playlist.helpers({
        playlist_songs: function() {
            var data = Playlists.find({type: type}).fetch();
            if (data !== undefined && data.length > 0) {
                return data[0].songs;
            } else {
                return [];
            }
        }
    });

    Template.room.onCreated(function () {
        var tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        var currentSong = undefined;
        var _sound = undefined;
        var yt_player = undefined;
        var size = 0;
        var artistStr;
        var temp = "";

        function getTimeElapsed() {
            if (currentSong !== undefined) {
                return Date.now() - currentSong.started;
            }
            return 0;
        }

        function getSongInfo(query, platform){
          var search = query;
          var titles = [];
          query = query.toLowerCase().split(" ").join("%20");
          $.ajax({
            type: "GET",
            url: 'https://api.spotify.com/v1/search?q=' + query + '&type=track',
            applicationType: "application/json",
            contentType: "json",
            success: function(data){
              console.log(data);
              for(var i in data){
                  for(var j in data[i].items){
                    if(search.indexOf(data[i].items[j].name) !== -1){
                      console.log(data[i].items[j].name);
                      var info = data[i].items[j];
                      Session.set("title", data[i].items[j].name);
                      console.log("Info: " + info);
                      if(platform === "youtube"){
                        Session.set("duration", data[i].items[j].duration_ms / 1000)
                        console.log(Session.get("duration"));
                      }
                      temp = "";
                      if(data[i].items[j].artists.length >= 2){
                        for(var k in data[i].items[j].artists){
                           temp = temp + data[i].items[j].artists[k].name + ", ";
                        }
                      } else{
                        for(var k in data[i].items[j].artists){
                           temp = temp + data[i].items[j].artists[k].name;
                        }
                      }
                      if(temp[temp.length-2] === ","){
                        artistStr = temp.substr(0,temp.length-2);
                      } else{
                        artistStr = temp;
                      }
                      Session.set("artist", artistStr);
                      $(".current").remove();
                      $(".room-title").before("<img class='current' src='" + data[i].items[j].album.images[1].url + "' />");
                      return true;
                    }
                  }
                  //---------------------------------------------------------------//

              }
            }
          })
        }

        function resizeSeekerbar() {
            $("#seeker-bar").width(((getTimeElapsed() / 1000) / Session.get("duration") * 100) + "%");
        }

        function startSong() {
            if (currentSong !== undefined) {
                if (_sound !== undefined) _sound.stop();
                if (yt_player !== undefined && yt_player.stopVideo !== undefined) yt_player.stopVideo();

                if (currentSong.song.type === "soundcloud") {
                  $("#player").attr("src", "")
                  getSongInfo(currentSong.song.title);
                  SC.stream("/tracks/" + currentSong.song.id + "#t=20s", function(sound){
                    console.log(sound);
                    _sound = sound;
                    sound._player._volume = 0.3;
                    sound.play();
                    console.log(getTimeElapsed());
                    var interval = setInterval(function() {
                        if (sound.getState() === "playing") {
                            sound.seek(getTimeElapsed());
                            window.clearInterval(interval);
                        }
                    }, 200);
                    // Session.set("title", currentSong.song.title || "Title");
                    // Session.set("artist", currentSong.song.artist || "Artist");
                    Session.set("duration", currentSong.song.duration);
                    resizeSeekerbar();
                  });
                } else {
                    if (yt_player === undefined) {
                        yt_player = new YT.Player("player", {
                            height: 540,
                            width: 960,
                            videoId: currentSong.song.id,
                            events: {
                                'onReady': function(event) {
                                    event.target.seekTo(getTimeElapsed() / 1000);
                                    event.target.playVideo();
                                    resizeSeekerbar();
                                },
                                'onStateChange': function(event){
                                    if (event.data == YT.PlayerState.PAUSED) {
                                        event.target.seekTo(getTimeElapsed() / 1000);
                                        event.target.playVideo();
                                    }
                                }
                            }
                        });
                    } else {
                        yt_player.loadVideoById(currentSong.song.id);
                    }

                    // Session.set("title", currentSong.song.title || "Title");
                    // Session.set("artist", currentSong.song.artist || "Artist");
                    getSongInfo(currentSong.song.title, "youtube");
                    //Session.set("duration", currentSong.song.duration);
                }
            }
        }

        Meteor.subscribe("history");
        Meteor.subscribe("playlists");
        Meteor.subscribe("rooms", function() {
            Session.set("loaded", false);
            console.log(Rooms.find({type: type}).fetch().length);
            if (Rooms.find({type: type}).count() !== 1) {
                window.location = "/";
            } else {
                Session.set("loaded", true);
                Meteor.setInterval(function () {
                    var data = undefined;
                    var dataCursor = History.find({type: type});
                    dataCursor.map(function (doc) {
                        if (data === undefined) {
                            data = doc;
                        }
                    });
                    if (data !== undefined && data.history.length > size) {
                        currentSong = data.history[data.history.length - 1];
                        size = data.history.length;
                        startSong();
                    }
                }, 1000);

                Meteor.setInterval(function () {
                    resizeSeekerbar();
                }, 50);
            }
        });
    });

    Template.admin.events({
        "submit form": function(e){
            e.preventDefault();
            var genre = e.target.genre.value;
            var type = e.target.type.value;
            var id = e.target.id.value;
            var title = e.target.title.value;
            var artist = e.target.artist.value;
            var songData = {type: type, id: id, title: title, artist: artist};
            Meteor.call("addPlaylistSong", genre, songData, function(err, res) {
                console.log(err, res);
            });
        }
    });
}

if (Meteor.isServer) {
    Meteor.startup(function() {
        reCAPTCHA.config({
            privatekey: '6LcVxg0TAAAAAI2fgIEEWHFxwNXeVIs8mzq5cfRM'
        });
    });

    Meteor.users.deny({update: function () { return true; }});
    Meteor.users.deny({insert: function () { return true; }});
    Meteor.users.deny({remove: function () { return true; }});

    function getSongDuration(query){
        var duration;
        var search = query;
        query = query.toLowerCase().split(" ").join("%20");

        var res = Meteor.http.get('https://api.spotify.com/v1/search?q=' + query + '&type=track');

        for(var i in res.data){
            for(var j in res.data[i].items){
                if(search.indexOf(res.data[i].items[j].name) !== -1){
                    duration = res.data[i].items[j].duration_ms / 1000;
                    console.log(duration);
                    return duration;
                }
            }
        }
    }

    function getSongAlbumArt(query){
        var albumart;
        var search = query;
        query = query.toLowerCase().split(" ").join("%20");

        var res = Meteor.http.get('https://api.spotify.com/v1/search?q=' + query + '&type=track');

        for(var i in res.data){
            for(var j in res.data[i].items){
                if(search.indexOf(res.data[i].items[j].name) !== -1){
                    albumart = res.data[i].items[j].album.images[1].url
                    return albumart;
                }
            }
        }
    }

    //var room_types = ["edm", "nightcore"];
    var songsArr = [];

    function getSongsByType(type) {
        if (type === "edm") {
            return [
                {id: "aE2GCa-_nyU", title: "Radioactive - Lindsey Stirling and Pentatonix", duration: getSongDuration("Radioactive - Lindsey Stirling and Pentatonix"), albumart: getSongAlbumArt("Radioactive - Lindsey Stirling and Pentatonix"), type: "youtube"},
                {id: "aHjpOzsQ9YI", title: "Crystallize", artist: "Linsdey Stirling", duration: getSongDuration("Crystallize"), albumart: getSongAlbumArt("Crystallize"), type: "youtube"}
            ];
        } else if (type === "nightcore") {
            return [{id: "f7RKOP87tt4", title: "Monster (DotEXE Remix)", duration: getSongDuration("Monster (DotEXE Remix)"), albumart: getSongAlbumArt("Monster (DotEXE Remix)"), type: "youtube"}];
        } else {
            return [{id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", duration: getSongDuration("Never Gonna Give You Up"), albumart: getSongAlbumArt("Never Gonna Give You Up"), type: "youtube"}];
        }
    }

    Rooms.find({}).fetch().forEach(function(room) {
        var type = room.type;
        if (Playlists.find({type: type}).count() === 0) {
            if (type === "edm") {
                Playlists.insert({type: type, songs: getSongsByType(type)});
            } else if (type === "nightcore") {
                Playlists.insert({type: type, songs: getSongsByType(type)});
            } else {
                Playlists.insert({type: type, songs: getSongsByType(type)});
            }
        }
        if (History.find({type: type}).count() === 0) {
            History.insert({type: type, history: []});
        }
        if (Playlists.find({type: type}).fetch()[0].songs.length === 0) {
            // Add a global video to Playlist so it can proceed
        } else {
            var startedAt = Date.now();
            var songs = Playlists.find({type: type}).fetch()[0].songs;
            var currentSong = 0;
            addToHistory(songs[currentSong], startedAt);

            function addToHistory(song, startedAt) {
                History.update({type: type}, {$push: {history: {song: song, started: startedAt}}});
            }

            function skipSong() {
                songs = Playlists.find({type: type}).fetch()[0].songs;
                if (currentSong < (songs.length - 1)) {
                    currentSong++;
                } else currentSong = 0;
                songTimer();
                addToHistory(songs[currentSong], startedAt);
            }

            function songTimer() {
                startedAt = Date.now();
                Meteor.setTimeout(function() {
                    skipSong();
                }, songs[currentSong].duration * 1000);
            }

            songTimer();
        }
    });



    ServiceConfiguration.configurations.remove({
        service: "facebook"
    });

    ServiceConfiguration.configurations.insert({
        service: "facebook",
        appId: "1496014310695890",
        secret: "9a039f254a08a1488c08bb0737dbd2a6"
    });

    ServiceConfiguration.configurations.remove({
        service: "github"
    });

    ServiceConfiguration.configurations.insert({
        service: "github",
        clientId: "dcecd720f47c0e4001f7",
        secret: "375939d001ef1a0ca67c11dbf8fb9aeaa551e01b"
    });

    Meteor.publish("history", function() {
        return History.find({})
    });

    Meteor.publish("playlists", function() {
        return Playlists.find({})
    });

    Meteor.publish("rooms", function() {
        return Rooms.find()
    });

    Meteor.methods({
        createUserMethod: function(formData, captchaData) {
            var verifyCaptchaResponse = reCAPTCHA.verifyCaptcha(this.connection.clientAddress, captchaData);
            if (!verifyCaptchaResponse.success) {
                console.log('reCAPTCHA check failed!', verifyCaptchaResponse);
                throw new Meteor.Error(422, 'reCAPTCHA Failed: ' + verifyCaptchaResponse.error);
            } else {
                console.log('reCAPTCHA verification passed!');
                Accounts.createUser({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password
                });
            }
            return true;
        },
        addPlaylistSong: function(type, songData) {
            type = type.toLowerCase();
            if (Rooms.find({type: type}).count() === 1) {
                if (songData !== undefined && Object.keys(songData).length === 4 && songData.type !== undefined && songData.title !== undefined && songData.title !== undefined && songData.artist !== undefined) {
                    songData.duration = getSongDuration(songData.title);
                    Playlists.update({type: type}, {$push: {songs: {id: songData.id, title: songData.title, artist: songData.artist, duration: songData.duration, type: songData.type}}});
                    return true;
                } else {
                    throw new Meteor.error(403, "Invalid data.");
                }
            } else {
                throw new Meteor.error(403, "Invalid genre.");
            }
        },
        createRoom: function(type) {
            if (Rooms.find({type: type}).count() === 0) {
                Rooms.insert({type: type}, function(err) {
                    if (err) {
                        throw err;
                    } else {
                        if (Playlists.find({type: type}).count() === 1) {
                            if (History.find({type: type}).count() === 0) {
                                History.insert({type: type, history: []}, function(err3) {
                                    if (err3) {
                                        throw err3;
                                    } else {
                                        startStation();
                                        return true;
                                    }
                                });
                            } else {
                                startStation();
                                return true;
                            }
                        } else {
                            Playlists.insert({type: type, songs: getSongsByType(type)}, function (err2) {
                                if (err2) {
                                    throw err2;
                                } else {
                                    if (History.find({type: type}).count() === 0) {
                                        History.insert({type: type, history: []}, function(err3) {
                                            if (err3) {
                                                throw err3;
                                            } else {
                                                startStation();
                                                return true;
                                            }
                                        });
                                    } else {
                                        startStation();
                                        return true;
                                    }
                                }
                            });
                        }
                    }
                });
            } else {
                throw "Room already exists";
            }
            function startStation() {
                var startedAt = Date.now();
                var songs = Playlists.find({type: type}).fetch()[0].songs;
                var currentSong = 0;
                addToHistory(songs[currentSong], startedAt);

                function addToHistory(song, startedAt) {
                    History.update({type: type}, {$push: {history: {song: song, started: startedAt}}});
                }

                function skipSong() {
                    songs = Playlists.find({type: type}).fetch()[0].songs;
                    if (currentSong < (songs.length - 1)) {
                        currentSong++;
                    } else currentSong = 0;
                    songTimer();
                    addToHistory(songs[currentSong], startedAt);
                }

                function songTimer() {
                    startedAt = Date.now();
                    Meteor.setTimeout(function() {
                        skipSong();
                    }, songs[currentSong].duration * 1000);
                }

                songTimer();
            }
        }
    });
}

Router.route("/", {
    template: "home"
});

Router.route("/admin", {
    template: "admin"
});

Router.route("/:type", {
    template: "room"
});

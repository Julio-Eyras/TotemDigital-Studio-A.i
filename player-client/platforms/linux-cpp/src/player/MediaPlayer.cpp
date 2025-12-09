#include "player/MediaPlayer.h"
#include <iostream>
#include <thread>
#include <chrono>

#ifdef HAVE_GSTREAMER
#include <gst/gst.h>
#endif

MediaPlayer::MediaPlayer() : isPlaying(false) {
#ifdef HAVE_GSTREAMER
    gst_init(nullptr, nullptr);
    pipeline = nullptr;
    videoSink = nullptr;
#endif
}

MediaPlayer::~MediaPlayer() {
    stop();
#ifdef HAVE_GSTREAMER
    if (pipeline) {
        gst_object_unref(pipeline);
    }
#endif
}

void MediaPlayer::play(const PlaylistItem& item) {
    stop();
    currentItem = item;
    isPlaying = true;

    if (item.type == "video") {
        playVideo(item);
    } else if (item.type == "image") {
        playImage(item);
    } else if (item.type == "html") {
        playHTML(item);
    }
}

void MediaPlayer::playVideo(const PlaylistItem& item) {
#ifdef HAVE_GSTREAMER
    std::string pipelineStr = "playbin uri=" + item.url;
    pipeline = gst_parse_launch(pipelineStr.c_str(), nullptr);
    
    if (pipeline) {
        gst_element_set_state(pipeline, GST_STATE_PLAYING);
    }
#else
    // Fallback: usar sistema externo (vlc, mpv, etc.)
    std::string cmd = "vlc --fullscreen --no-audio --loop " + item.url + " &";
    system(cmd.c_str());
#endif
}

void MediaPlayer::playImage(const PlaylistItem& item) {
    // Usar feh ou similar para exibir imagem
    std::string cmd = "feh --fullscreen " + item.url + " &";
    system(cmd.c_str());
    
    // Aguardar duração
    int duration = item.duration > 0 ? item.duration : 10000;
    std::this_thread::sleep_for(std::chrono::milliseconds(duration));
}

void MediaPlayer::playHTML(const PlaylistItem& item) {
    // Usar browser headless (chromium, etc.)
    std::string cmd = "chromium --kiosk --app=" + item.url + " &";
    system(cmd.c_str());
    
    // Aguardar duração
    int duration = item.duration > 0 ? item.duration : 30000;
    std::this_thread::sleep_for(std::chrono::milliseconds(duration));
}

void MediaPlayer::stop() {
    isPlaying = false;
#ifdef HAVE_GSTREAMER
    if (pipeline) {
        gst_element_set_state(pipeline, GST_STATE_NULL);
        gst_object_unref(pipeline);
        pipeline = nullptr;
    }
#endif
}

void MediaPlayer::waitForCompletion() {
    while (isPlaying) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
}


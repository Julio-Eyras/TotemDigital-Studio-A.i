#ifndef MEDIA_PLAYER_H
#define MEDIA_PLAYER_H

#include "core/PlaylistManager.h"
#include <thread>
#include <chrono>

#ifdef HAVE_GSTREAMER
#include <gst/gst.h>
#endif

class MediaPlayer {
public:
    MediaPlayer();
    ~MediaPlayer();

    void play(const PlaylistItem& item);
    void stop();
    void waitForCompletion();

private:
    PlaylistItem currentItem;
    bool isPlaying;
    std::thread playThread;

#ifdef HAVE_GSTREAMER
    GstElement* pipeline;
    GstElement* videoSink;
#endif

    void playVideo(const PlaylistItem& item);
    void playImage(const PlaylistItem& item);
    void playHTML(const PlaylistItem& item);
};

#endif // MEDIA_PLAYER_H


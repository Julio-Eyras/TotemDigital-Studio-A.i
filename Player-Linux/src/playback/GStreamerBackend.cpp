#include "playback/IMediaBackend.hpp"

#include "ops/FieldOps.hpp"
#include "util/Logger.hpp"

#include <gst/gst.h>

#include <atomic>
#include <chrono>
#include <cstring>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>

namespace player::playback {

namespace {

constexpr int kCanvasW = 720;
constexpr int kCanvasH = 1280;

bool isHtmlType(const std::string& mediaType, const std::string& path) {
  const auto t = mediaType;
  if (t.find("html") != std::string::npos || t.find("web") != std::string::npos) return true;
  const auto p = path;
  return p.size() > 5 && (p.rfind(".html") == p.size() - 5 || p.rfind(".htm") == p.size() - 4);
}

bool isImageType(const std::string& mediaType, const std::string& path) {
  const auto t = mediaType;
  if (t.find("image") != std::string::npos || t.find("jpeg") != std::string::npos ||
      t.find("png") != std::string::npos || t.find("jpg") != std::string::npos)
    return true;
  auto ends = [&](const char* ext) {
    const size_t n = std::strlen(ext);
    return path.size() >= n && path.compare(path.size() - n, n, ext) == 0;
  };
  return ends(".jpg") || ends(".jpeg") || ends(".png") || ends(".webp");
}

int htmlDuration(int declared) { return (declared < 30) ? 60 : declared; }
int imageDuration(int declared) { return declared > 0 ? declared : 10; }

GstElement* makeFitSink() {
  GstElement* bin = gst_bin_new("fit-sink");
  GstElement* conv = gst_element_factory_make("videoconvert", "fit-convert");
  GstElement* scale = gst_element_factory_make("videoscale", "fit-scale");
  GstElement* capsfilter = gst_element_factory_make("capsfilter", "fit-caps");
  GstElement* sink = gst_element_factory_make("autovideosink", "fit-out");
  if (!bin || !conv || !scale || !capsfilter || !sink) {
    if (bin) gst_object_unref(bin);
    return nullptr;
  }
  g_object_set(scale, "add-borders", TRUE, nullptr);
  GstCaps* caps = gst_caps_new_simple("video/x-raw", "width", G_TYPE_INT, kCanvasW, "height",
                                      G_TYPE_INT, kCanvasH, "pixel-aspect-ratio", GST_TYPE_FRACTION,
                                      1, 1, nullptr);
  g_object_set(capsfilter, "caps", caps, nullptr);
  gst_caps_unref(caps);
  gst_bin_add_many(GST_BIN(bin), conv, scale, capsfilter, sink, nullptr);
  if (!gst_element_link_many(conv, scale, capsfilter, sink, nullptr)) {
    gst_object_unref(bin);
    return nullptr;
  }
  GstPad* pad = gst_element_get_static_pad(conv, "sink");
  GstPad* ghost = gst_ghost_pad_new("sink", pad);
  gst_object_unref(pad);
  gst_pad_set_active(ghost, TRUE);
  gst_element_add_pad(bin, ghost);
  return bin;
}

}  // namespace

class GStreamerBackend : public IMediaBackend {
public:
  GStreamerBackend() {
    static std::once_flag once;
    std::call_once(once, [] { gst_init(nullptr, nullptr); });
  }

  ~GStreamerBackend() override { stop(); }

  bool playBlackVeil(int durationMs) override {
    stop();
    const int ms = durationMs > 0 ? durationMs : 300;
    durationLimitSec_ = 0;
    holdUntilDuration_ = false;
    GError* err = nullptr;
    const std::string desc =
        "videotestsrc pattern=black num-buffers=12 is-live=true ! videoconvert ! "
        "videoscale add-borders=true ! video/x-raw,width=720,height=1280,pixel-aspect-ratio=1/1 ! "
        "autovideosink sync=false";
    pipeline_ = gst_parse_launch(desc.c_str(), &err);
    if (err) {
      util::Logger::w("PLAYBACK", std::string("véu parse: ") + err->message);
      g_error_free(err);
    }
    if (!pipeline_) return false;
    gst_element_set_state(pipeline_, GST_STATE_PLAYING);
    playing_ = true;
    startedAt_ = std::chrono::steady_clock::now();
    std::this_thread::sleep_for(std::chrono::milliseconds(ms));
    stop();
    return true;
  }

  bool playFile(const std::string& path,
                const std::string& mediaType,
                int durationSeconds,
                bool allowAudio) override {
    stop();
    if (isHtmlType(mediaType, path)) {
      durationLimitSec_ = htmlDuration(durationSeconds);
      holdUntilDuration_ = true;
      try {
        htmlProc_ = ops::spawnHtmlKiosk(path);
      } catch (const std::exception& ex) {
        util::Logger::e("PLAYBACK", std::string("HTML kiosk: ") + ex.what());
        return false;
      }
      playing_ = true;
      startedAt_ = std::chrono::steady_clock::now();
      util::Logger::i("PLAYBACK", "HTML " + path + " " + std::to_string(durationLimitSec_) + "s");
      return true;
    }

    holdUntilDuration_ = isImageType(mediaType, path);
    if (holdUntilDuration_) durationLimitSec_ = imageDuration(durationSeconds);
    else durationLimitSec_ = durationSeconds;

    if (holdUntilDuration_ && tryImagePipeline(path)) {
      playing_ = true;
      startedAt_ = std::chrono::steady_clock::now();
      util::Logger::i("PLAYBACK", "GStreamer FIT image " + path);
      return true;
    }
    return playWithPlaybin(path, allowAudio);
  }

  void stop() override {
    playing_ = false;
    if (htmlProc_.pid > 0) {
      ops::killChild(htmlProc_);
      htmlProc_ = {};
    }
    if (pipeline_) {
      gst_element_set_state(pipeline_, GST_STATE_NULL);
      gst_object_unref(pipeline_);
      pipeline_ = nullptr;
    }
  }

  bool isPlaying() const override {
    if (!playing_) return false;
    if (durationLimitSec_ > 0) {
      const auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                               std::chrono::steady_clock::now() - startedAt_)
                               .count();
      if (elapsed >= durationLimitSec_) return false;
      if (holdUntilDuration_ || htmlProc_.pid > 0) return true;
    }
    if (htmlProc_.pid > 0) return true;
    if (!pipeline_) return false;
    GstState state = GST_STATE_NULL;
    gst_element_get_state(pipeline_, &state, nullptr, 0);
    if (state == GST_STATE_PLAYING || state == GST_STATE_PAUSED) {
      GstBus* bus = gst_element_get_bus(pipeline_);
      GstMessage* msg =
          gst_bus_pop_filtered(bus, static_cast<GstMessageType>(GST_MESSAGE_EOS | GST_MESSAGE_ERROR));
      if (msg) {
        const bool eos = GST_MESSAGE_TYPE(msg) == GST_MESSAGE_EOS;
        gst_message_unref(msg);
        gst_object_unref(bus);
        if (eos && holdUntilDuration_) return true;
        return !eos;
      }
      gst_object_unref(bus);
      return true;
    }
    return holdUntilDuration_;
  }

private:
  bool tryImagePipeline(const std::string& path) {
    gchar* uri = gst_filename_to_uri(path.c_str(), nullptr);
    if (!uri) return false;
    GError* err = nullptr;
    const std::string desc = std::string("uridecodebin uri=\"") + uri +
                             "\" ! imagefreeze ! videoconvert ! videoscale add-borders=true ! "
                             "video/x-raw,width=720,height=1280,pixel-aspect-ratio=1/1 ! "
                             "autovideosink sync=false";
    g_free(uri);
    pipeline_ = gst_parse_launch(desc.c_str(), &err);
    if (err) {
      util::Logger::w("PLAYBACK", std::string("image pipeline: ") + err->message);
      g_error_free(err);
    }
    if (!pipeline_) return false;
    const GstStateChangeReturn ret = gst_element_set_state(pipeline_, GST_STATE_PLAYING);
    if (ret == GST_STATE_CHANGE_FAILURE) {
      stop();
      return false;
    }
    return true;
  }

  bool playWithPlaybin(const std::string& path, bool allowAudio) {
    pipeline_ = gst_element_factory_make("playbin", "player");
    if (!pipeline_) {
      util::Logger::e("PLAYBACK", "GStreamer playbin indisponível");
      return false;
    }
    gchar* uri = gst_filename_to_uri(path.c_str(), nullptr);
    if (!uri) {
      stop();
      return false;
    }
    g_object_set(pipeline_, "uri", uri, nullptr);
    g_free(uri);
    if (!allowAudio) g_object_set(pipeline_, "volume", 0.0, nullptr);
    // FIT no sink (videoscale add-borders); playbin não deve forçar outro letterbox.
    g_object_set(pipeline_, "force-aspect-ratio", FALSE, nullptr);
    if (GstElement* sink = makeFitSink()) {
      g_object_set(pipeline_, "video-sink", sink, nullptr);
    } else {
      g_object_set(pipeline_, "force-aspect-ratio", TRUE, nullptr);
    }

    const GstStateChangeReturn ret = gst_element_set_state(pipeline_, GST_STATE_PLAYING);
    if (ret == GST_STATE_CHANGE_FAILURE) {
      util::Logger::e("PLAYBACK", "Falha a iniciar GStreamer path=" + path);
      stop();
      return false;
    }
    playing_ = true;
    startedAt_ = std::chrono::steady_clock::now();
    util::Logger::i("PLAYBACK", "GStreamer FIT 720x1280 " + path);
    return true;
  }

  GstElement* pipeline_ = nullptr;
  ops::ChildProc htmlProc_{};
  std::atomic<bool> playing_{false};
  bool holdUntilDuration_ = false;
  int durationLimitSec_ = 0;
  std::chrono::steady_clock::time_point startedAt_{};
};

std::unique_ptr<IMediaBackend> createMediaBackend() {
  return std::make_unique<GStreamerBackend>();
}

}  // namespace player::playback

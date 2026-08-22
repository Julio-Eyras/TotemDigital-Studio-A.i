#include "playback/IMediaBackend.hpp"

#include "util/Logger.hpp"

#include <gst/gst.h>

#include <atomic>
#include <chrono>
#include <memory>
#include <mutex>

namespace player::playback {

class GStreamerBackend : public IMediaBackend {
public:
  GStreamerBackend() {
    static std::once_flag once;
    std::call_once(once, [] { gst_init(nullptr, nullptr); });
  }

  ~GStreamerBackend() override { stop(); }

  bool playFile(const std::string& path,
                const std::string& mediaType,
                int durationSeconds,
                bool allowAudio) override {
    stop();
    durationLimitSec_ = durationSeconds;
    if (durationLimitSec_ <= 0 && mediaType.find("image") != std::string::npos) durationLimitSec_ = 10;
    if (durationLimitSec_ <= 0 && mediaType.find("html") != std::string::npos) durationLimitSec_ = 60;

    // playbin: FIT natural via force-aspect-ratio (contain) — parity TextureView FIT
    pipeline_ = gst_element_factory_make("playbin", "player");
    if (!pipeline_) {
      util::Logger::e("PLAYBACK", "GStreamer playbin indisponível");
      return false;
    }
    const std::string uri = "file://" + path;
    g_object_set(pipeline_, "uri", uri.c_str(), nullptr);
    if (!allowAudio) g_object_set(pipeline_, "volume", 0.0, nullptr);
    g_object_set(pipeline_, "force-aspect-ratio", TRUE, nullptr);

    const GstStateChangeReturn ret = gst_element_set_state(pipeline_, GST_STATE_PLAYING);
    if (ret == GST_STATE_CHANGE_FAILURE) {
      util::Logger::e("PLAYBACK", "Falha a iniciar GStreamer path=" + path);
      stop();
      return false;
    }
    playing_ = true;
    startedAt_ = std::chrono::steady_clock::now();
    util::Logger::i("PLAYBACK", "GStreamer play " + mediaType + " " + path);
    return true;
  }

  void stop() override {
    playing_ = false;
    if (pipeline_) {
      gst_element_set_state(pipeline_, GST_STATE_NULL);
      gst_object_unref(pipeline_);
      pipeline_ = nullptr;
    }
  }

  bool isPlaying() const override {
    if (!playing_ || !pipeline_) return false;
    if (durationLimitSec_ > 0) {
      const auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                               std::chrono::steady_clock::now() - startedAt_)
                               .count();
      if (elapsed >= durationLimitSec_) return false;
    }
    GstState state = GST_STATE_NULL;
    gst_element_get_state(pipeline_, &state, nullptr, 0);
    if (state == GST_STATE_PLAYING || state == GST_STATE_PAUSED) {
      // EOS check
      GstBus* bus = gst_element_get_bus(pipeline_);
      GstMessage* msg = gst_bus_pop_filtered(bus, static_cast<GstMessageType>(GST_MESSAGE_EOS | GST_MESSAGE_ERROR));
      if (msg) {
        const bool eos = GST_MESSAGE_TYPE(msg) == GST_MESSAGE_EOS;
        gst_message_unref(msg);
        gst_object_unref(bus);
        return !eos;
      }
      gst_object_unref(bus);
      return true;
    }
    return false;
  }

private:
  GstElement* pipeline_ = nullptr;
  std::atomic<bool> playing_{false};
  int durationLimitSec_ = 0;
  std::chrono::steady_clock::time_point startedAt_{};
};

std::unique_ptr<IMediaBackend> createMediaBackend() {
  return std::make_unique<GStreamerBackend>();
}

}  // namespace player::playback

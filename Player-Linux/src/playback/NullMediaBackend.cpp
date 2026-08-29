#include "playback/IMediaBackend.hpp"

#include "util/Logger.hpp"

#include <chrono>
#include <memory>
#include <thread>

namespace player::playback {

class NullMediaBackend : public IMediaBackend {
public:
  bool playFile(const std::string& path,
                const std::string& mediaType,
                int durationSeconds,
                bool /*allowAudio*/) override {
    int sec = durationSeconds;
    if (sec <= 0) {
      if (mediaType.find("image") != std::string::npos) sec = 10;
      else if (mediaType.find("html") != std::string::npos) sec = 60;
      else sec = 15;
    }
    util::Logger::i("PLAYBACK", "STUB play " + mediaType + " path=" + path + " " + std::to_string(sec) + "s");
    playing_ = true;
    endAt_ = std::chrono::steady_clock::now() + std::chrono::seconds(sec);
    return true;
  }

  bool playBlackVeil(int durationMs) override {
    const int ms = durationMs > 0 ? durationMs : 300;
    util::Logger::i("PLAYBACK", "STUB véu " + std::to_string(ms) + "ms");
    std::this_thread::sleep_for(std::chrono::milliseconds(ms));
    return true;
  }

  void stop() override { playing_ = false; }

  bool isPlaying() const override {
    if (!playing_) return false;
    if (std::chrono::steady_clock::now() >= endAt_) {
      playing_ = false;
      return false;
    }
    return true;
  }

private:
  mutable bool playing_ = false;
  std::chrono::steady_clock::time_point endAt_{};
};

#ifndef PLAYER_LINUX_WITH_GSTREAMER
std::unique_ptr<IMediaBackend> createMediaBackend() {
  return std::make_unique<NullMediaBackend>();
}
#endif

}  // namespace player::playback

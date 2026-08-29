#pragma once

#include <functional>
#include <memory>
#include <string>

namespace player::playback {

/** Backend de mídia (GStreamer ou stub). */
class IMediaBackend {
public:
  virtual ~IMediaBackend() = default;
  virtual bool playFile(const std::string& path,
                        const std::string& mediaType,
                        int durationSeconds,
                        bool allowAudio) = 0;
  /** Véu preto FIT 720×1280 (~300 ms entre mídias). */
  virtual bool playBlackVeil(int durationMs) = 0;
  virtual void stop() = 0;
  virtual bool isPlaying() const = 0;
};

using BackendFactory = std::function<std::unique_ptr<IMediaBackend>()>;

std::unique_ptr<IMediaBackend> createMediaBackend();

}  // namespace player::playback

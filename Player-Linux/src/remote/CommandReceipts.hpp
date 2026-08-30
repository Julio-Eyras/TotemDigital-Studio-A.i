#pragma once

#include <cstddef>
#include <string>
#include <unordered_set>

namespace player::remote {

/** ACK at-most-once persistido em remote-command-receipts.json. */
class CommandReceipts {
public:
  static constexpr std::size_t kMaxIds = 200;

  explicit CommandReceipts(std::string path);

  bool contains(const std::string& id) const;
  void remember(const std::string& id);
  std::size_t size() const { return ids_.size(); }

private:
  std::string path_;
  std::unordered_set<std::string> ids_;

  void load();
  void save() const;
};

}  // namespace player::remote

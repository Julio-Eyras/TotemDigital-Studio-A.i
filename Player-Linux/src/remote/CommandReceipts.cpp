#include "remote/CommandReceipts.hpp"

#include <fstream>

#include <nlohmann/json.hpp>

namespace player::remote {

CommandReceipts::CommandReceipts(std::string path) : path_(std::move(path)) { load(); }

void CommandReceipts::load() {
  ids_.clear();
  std::ifstream in(path_);
  if (!in) return;
  try {
    nlohmann::json j;
    in >> j;
    if (!j.is_array()) return;
    for (const auto& v : j) {
      if (v.is_string()) ids_.insert(v.get<std::string>());
    }
  } catch (...) {
    ids_.clear();
  }
}

void CommandReceipts::save() const {
  nlohmann::json arr = nlohmann::json::array();
  for (const auto& id : ids_) arr.push_back(id);
  std::ofstream out(path_);
  if (out) out << arr.dump();
}

bool CommandReceipts::contains(const std::string& id) const { return ids_.count(id) != 0; }

void CommandReceipts::remember(const std::string& id) {
  if (id.empty()) return;
  ids_.insert(id);
  if (ids_.size() > kMaxIds) {
    ids_.clear();
    ids_.insert(id);
  }
  save();
}

}  // namespace player::remote

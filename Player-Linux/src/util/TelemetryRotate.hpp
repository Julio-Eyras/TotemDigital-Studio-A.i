#pragma once

#include <cstdint>
#include <string>

namespace player::util {

/** Se o jsonl passar de maxBytes, rename para path+".1". Devolve true se rodou. */
bool rotateJsonlIfNeeded(const std::string& path, std::uintmax_t maxBytes);

}  // namespace player::util

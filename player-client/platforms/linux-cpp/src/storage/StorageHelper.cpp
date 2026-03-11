/**
 * StorageHelper - Linux C++
 * Implementação: interno + USB, externo por defeito.
 */

#include "storage/StorageHelper.h"
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <sys/stat.h>
#include <unistd.h>
#include <algorithm>
#include <filesystem>

namespace SmartSignage {

StorageHelper::StorageHelper() : useExternalFirst_(true) {
    const char* storagePath = std::getenv("STORAGE_PATH");
    if (storagePath && storagePath[0]) {
        internalPathBase_ = storagePath;
    } else {
        internalPathBase_ = getDefaultInternalPath();
    }
    const char* extFirst = std::getenv("STORAGE_USE_EXTERNAL_FIRST");
    if (extFirst) {
        std::string s(extFirst);
        useExternalFirst_ = (s == "1" || s == "true" || s == "yes");
    }
    usbRoots_ = getUsbMountPoints();
}

std::string StorageHelper::getDefaultInternalPath() const {
    const char* home = std::getenv("HOME");
    if (home && home[0]) {
        return std::string(home) + "/.cache/smartsignage";
    }
    return "/tmp/smartsignage";
}

std::vector<std::string> StorageHelper::getUsbMountPoints() const {
    std::vector<std::string> roots;
    std::ifstream mounts("/proc/mounts");
    if (!mounts) return roots;
    std::string line;
    while (std::getline(mounts, line)) {
        std::istringstream iss(line);
        std::string dev, path, fstype;
        if (iss >> dev >> path >> fstype) {
            if ((path.compare(0, 7, "/media/") == 0 || path.compare(0, 5, "/mnt/") == 0) &&
                path != "/media" && path != "/mnt") {
                struct stat st;
                if (stat(path.c_str(), &st) == 0 && S_ISDIR(st.st_mode)) {
                    roots.push_back(path);
                }
            }
        }
    }
    return roots;
}

std::vector<std::string> StorageHelper::getStorageRoots() const {
    std::vector<std::string> out;
    if (useExternalFirst_ && !usbRoots_.empty()) {
        for (const auto& r : usbRoots_) out.push_back(r);
        out.push_back(internalPathBase_);
    } else {
        out.push_back(internalPathBase_);
        for (const auto& r : usbRoots_) out.push_back(r);
    }
    return out;
}

void StorageHelper::ensurePropagandasDirs() const {
    for (const auto& root : getStorageRoots()) {
        std::filesystem::path p = root;
        p /= PROPAGANDAS_DIR;
        std::error_code ec;
        std::filesystem::create_directories(p, ec);
    }
}

std::string StorageHelper::getWritePropagandasDir() const {
    auto roots = getStorageRoots();
    if (roots.empty()) return internalPathBase_ + "/" + PROPAGANDAS_DIR;
    return roots[0] + "/" + PROPAGANDAS_DIR;
}

std::string StorageHelper::resolveMediaPath(const std::string& mediaId, const std::string& extension) const {
    static const std::vector<std::string> defaultExts = {
        "mp4", "webm", "jpg", "jpeg", "png", "gif", "webp", "mov", "bin"
    };
    std::vector<std::string> exts;
    if (!extension.empty()) {
        exts.push_back(extension);
    } else {
        exts = defaultExts;
    }
    auto roots = getStorageRoots();
    for (const auto& root : roots) {
        std::string propDir = root + "/" + PROPAGANDAS_DIR;
        for (const auto& ext : exts) {
            std::string path = propDir + "/" + mediaId + "." + ext;
            struct stat st;
            if (stat(path.c_str(), &st) == 0 && S_ISREG(st.st_mode)) {
                return path;
            }
        }
    }
    return "";
}

} // namespace SmartSignage

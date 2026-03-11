/**
 * StorageHelper - Linux C++
 * Storage EXTERNO por defeito (configurável na opção administrativa).
 * Path fixo .../propagandas; interno + USB. Ref.: DESIGN 3.3
 */

#ifndef STORAGE_HELPER_H
#define STORAGE_HELPER_H

#include <string>
#include <vector>

namespace SmartSignage {

class StorageHelper {
public:
    static constexpr const char* PROPAGANDAS_DIR = "propagandas";

    StorageHelper();

    /** Ordem de roots: por defeito [externo (USB) primeiro, depois interno] */
    std::vector<std::string> getStorageRoots() const;
    /** Garante que a pasta propagandas existe em todos os roots. Chamar ao arranque. */
    void ensurePropagandasDirs() const;
    /** Path para gravar (primeiro root + /propagandas) */
    std::string getWritePropagandasDir() const;
    /** Resolve path do ficheiro para reprodução; retorna vazio se não existir */
    std::string resolveMediaPath(const std::string& mediaId, const std::string& extension = "") const;

    bool getUseExternalFirst() const { return useExternalFirst_; }
    void setUseExternalFirst(bool v) { useExternalFirst_ = v; }

private:
    std::string getDefaultInternalPath() const;
    std::vector<std::string> getUsbMountPoints() const;

    std::string internalPathBase_;
    std::vector<std::string> usbRoots_;
    bool useExternalFirst_;
};

} // namespace SmartSignage

#endif // STORAGE_HELPER_H

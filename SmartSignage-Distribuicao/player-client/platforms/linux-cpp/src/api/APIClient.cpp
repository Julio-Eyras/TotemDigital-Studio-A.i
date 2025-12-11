/**
 * API Client - Linux C++
 * Implementação
 */

#include "api/APIClient.h"
#include <sstream>
#include <iomanip>
#include <ctime>
#include <openssl/hmac.h>
#include <openssl/sha.h>
#include <openssl/evp.h>

APIClient::APIClient(const std::string& baseURL, const std::string& totemUIN, const std::string& totemSecret)
    : baseURL(baseURL), totemUIN(totemUIN), totemSecret(totemSecret), curl(nullptr) {
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
}

APIClient::~APIClient() {
    if (curl) {
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
}

std::string APIClient::generateTotemToken() {
    auto timestamp = std::to_string(std::time(nullptr) * 1000);
    std::string data = totemUIN + ":" + timestamp;

    unsigned char digest[SHA256_DIGEST_LENGTH];
    unsigned int digestLen;
    
    HMAC(EVP_sha256(), totemSecret.c_str(), totemSecret.length(),
         (unsigned char*)data.c_str(), data.length(), digest, &digestLen);

    std::stringstream ss;
    for (unsigned int i = 0; i < digestLen; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)digest[i];
    }

    return timestamp + ":" + ss.str();
}

size_t APIClient::WriteCallback(void* contents, size_t size, size_t nmemb, std::string* data) {
    size_t totalSize = size * nmemb;
    data->append((char*)contents, totalSize);
    return totalSize;
}

Json::Value APIClient::request(const std::string& endpoint, const std::string& method, const Json::Value& body) {
    std::string url = baseURL + endpoint;
    std::string responseData;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseData);

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    if (!totemUIN.empty() && !totemSecret.empty()) {
        std::string token = generateTotemToken();
        std::string tokenHeader = "X-Totem-Token: " + token;
        std::string uinHeader = "X-Totem-UIN: " + totemUIN;
        headers = curl_slist_append(headers, tokenHeader.c_str());
        headers = curl_slist_append(headers, uinHeader.c_str());
    }

    if (!token.empty()) {
        std::string authHeader = "Authorization: Bearer " + token;
        headers = curl_slist_append(headers, authHeader.c_str());
    }

    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    if (method == "POST" || method == "PUT" || method == "PATCH") {
        Json::StreamWriterBuilder builder;
        std::string bodyStr = Json::writeString(builder, body);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bodyStr.c_str());
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, method.c_str());
    }

    CURLcode res = curl_easy_perform(curl);
    curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        throw std::runtime_error("CURL error: " + std::string(curl_easy_strerror(res)));
    }

    long responseCode;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &responseCode);

    if (responseCode != 200) {
        throw std::runtime_error("HTTP error: " + std::to_string(responseCode));
    }

    Json::Value jsonResponse;
    Json::Reader reader;
    reader.parse(responseData, jsonResponse);

    return jsonResponse;
}

bool APIClient::authenticateTotem() {
    try {
        Json::Value body;
        body["uin"] = totemUIN;
        Json::Value response = request("/api/player/register", "POST", body);

        if (response.isMember("token")) {
            token = response["token"].asString();
            refreshToken = response["refreshToken"].asString();
            return true;
        }
        return false;
    } catch (const std::exception& e) {
        return false;
    }
}

Json::Value APIClient::getPlaylist() {
    return request("/api/player/playlist");
}

Json::Value APIClient::getConfig() {
    return request("/api/player/config");
}

bool APIClient::sendHeartbeat(const Json::Value& data) {
    try {
        request("/api/player/heartbeat", "POST", data);
        return true;
    } catch (const std::exception& e) {
        return false;
    }
}

bool APIClient::sendErrorLog(const std::string& error, const std::string& stack, const Json::Value& metadata) {
    try {
        Json::Value body;
        body["error"] = error;
        body["stack"] = stack;
        body["metadata"] = metadata;
        request("/api/logs/frontend-error", "POST", body);
        return true;
    } catch (const std::exception& e) {
        return false;
    }
}


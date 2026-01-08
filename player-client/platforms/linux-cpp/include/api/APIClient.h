/**
 * API Client - Linux C++
 * Cliente HTTP para comunicação com o backend
 */

#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <string>
#include <memory>
#include <curl/curl.h>
#include <jsoncpp/json/json.h>

class APIClient {
public:
    APIClient(const std::string& baseURL, const std::string& totemUIN, const std::string& totemSecret);
    ~APIClient();

    bool authenticateTotem();
    Json::Value getPlaylist();
    Json::Value getConfig();
    bool sendHeartbeat(const Json::Value& data);
    bool sendErrorLog(const std::string& error, const std::string& stack, const Json::Value& metadata);

    std::string getToken() const { return token; }

private:
    void logValidationError(const std::string& endpoint, long statusCode, const std::string& code);

private:
    std::string baseURL;
    std::string totemUIN;
    std::string totemSecret;
    std::string token;
    std::string refreshToken;
    CURL* curl;

    std::string generateTotemToken();
    Json::Value request(const std::string& endpoint, const std::string& method = "GET", const Json::Value& body = Json::Value());
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* data);
    void logValidationError(const std::string& endpoint, long statusCode, const std::string& code);
};

#endif // API_CLIENT_H


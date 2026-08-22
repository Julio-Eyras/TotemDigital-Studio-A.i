cmake_minimum_required(VERSION 3.16)
project(PlayerLinux VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(PLAYER_LINUX_WITH_GSTREAMER "Build with GStreamer video backend" ON)

find_package(CURL REQUIRED)
find_package(Threads REQUIRED)
find_package(nlohmann_json 3.2.0 QUIET)
if(NOT nlohmann_json_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
  )
  FetchContent_MakeAvailable(json)
endif()

set(PLAYER_LINUX_SOURCES
  src/main.cpp
  src/util/Logger.cpp
  src/util/Paths.cpp
  src/config/PlayerConfig.cpp
  src/config/DisplaySchedule.cpp
  src/config/PollAdaptive.cpp
  src/api/DispatcherClient.cpp
  src/cache/MediaCache.cpp
  src/playback/PlayerOrchestrator.cpp
  src/remote/CommandExecutor.cpp
)

add_executable(player-linux ${PLAYER_LINUX_SOURCES})

target_include_directories(player-linux PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_compile_definitions(player-linux PRIVATE
  PLAYER_LINUX_VERSION="${PROJECT_VERSION}"
  PLAYER_LINUX_PARITY_AD="2.13/113"
)

target_link_libraries(player-linux PRIVATE
  CURL::libcurl
  Threads::Threads
  nlohmann_json::nlohmann_json
)

if(PLAYER_LINUX_WITH_GSTREAMER)
  find_package(PkgConfig REQUIRED)
  pkg_check_modules(GST REQUIRED
    gstreamer-1.0
    gstreamer-video-1.0
    gstreamer-app-1.0
  )
  target_sources(player-linux PRIVATE src/playback/GStreamerBackend.cpp)
  target_include_directories(player-linux PRIVATE ${GST_INCLUDE_DIRS})
  target_link_libraries(player-linux PRIVATE ${GST_LIBRARIES})
  target_compile_definitions(player-linux PRIVATE PLAYER_LINUX_WITH_GSTREAMER=1)
else()
  target_sources(player-linux PRIVATE src/playback/NullMediaBackend.cpp)
endif()

install(TARGETS player-linux RUNTIME DESTINATION bin)
install(FILES config/exemplo-player-config.json DESTINATION share/player-linux)

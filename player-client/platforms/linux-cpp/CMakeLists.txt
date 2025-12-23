cmake_minimum_required(VERSION 3.16)
project(SmartSignagePlayer VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Dependências
find_package(PkgConfig REQUIRED)
pkg_check_modules(CURL REQUIRED libcurl)
pkg_check_modules(JSONCPP REQUIRED jsoncpp)

# Opcional: GStreamer para media player
pkg_check_modules(GSTREAMER gstreamer-1.0)

# Incluir diretórios
include_directories(include)

# Arquivos fonte
file(GLOB_RECURSE SOURCES "src/*.cpp")
file(GLOB_RECURSE HEADERS "include/*.h")

# Executável
add_executable(smartsignage-player ${SOURCES} ${HEADERS})

# Link libraries
target_link_libraries(smartsignage-player
    ${CURL_LIBRARIES}
    ${JSONCPP_LIBRARIES}
    pthread
)

if(GSTREAMER_FOUND)
    target_link_libraries(smartsignage-player ${GSTREAMER_LIBRARIES})
    target_compile_definitions(smartsignage-player PRIVATE HAVE_GSTREAMER)
endif()

# Flags de compilação
target_compile_options(smartsignage-player PRIVATE
    -Wall
    -Wextra
    -O2
)

# Instalação
install(TARGETS smartsignage-player DESTINATION bin)
install(FILES systemd/smartsignage-player.service DESTINATION /etc/systemd/system)

